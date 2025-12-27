# backend/src/ai_organizer/api/routes/upload.py
from __future__ import annotations

import hashlib
import re
import shutil
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ai_organizer.core.config import settings
from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Upload, Document, User

from ai_organizer.ingest.parsers import (
    read_text_file,
    parse_chatgpt_export_json,
    read_docx_file,
)

router = APIRouter()


# -----------------------------
# Response schemas
# -----------------------------
class UploadOut(BaseModel):
    uploadId: int
    documentId: int
    sourceType: str
    filename: str
    deduped: bool = False


class UploadListItem(BaseModel):
    uploadId: int
    documentId: int
    filename: str
    sizeBytes: int
    contentType: str


# -----------------------------
# Helpers
# -----------------------------
def _safe_filename(name: str) -> str:
    name = (name or "").strip()
    name = re.sub(r"[^\w.\-]+", "_", name, flags=re.UNICODE)
    return name[:180] if name else "file"


def _unique_path(folder: Path, filename: str) -> Path:
    target = folder / filename
    if not target.exists():
        return target

    stem = target.stem
    suffix = target.suffix
    i = 1
    while True:
        candidate = folder / f"{stem}({i}){suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _dedupe_if_exists(
    session: Session,
    user_id: int,
    new_path: Path,
    new_size: int,
    safe_name: str,
) -> Optional[tuple[int, int]]:
    """
    Αν βρεθεί ίδιο αρχείο (hash match) σε προηγούμενο upload του χρήστη:
    - σβήνει το νέο αρχείο από disk
    - επιστρέφει (upload_id, document_id)
    """
    stem = Path(safe_name).stem
    suffix = Path(safe_name).suffix.lower()

    # Μειώνουμε κόστος: κοιτάμε μόνο ίδια κατάληξη + ίδιο μέγεθος + "παρόμοιο" filename
    candidates = session.exec(
        select(Upload).where(
            Upload.user_id == user_id,
            Upload.size_bytes == new_size,
            Upload.filename.like(f"{stem}%{suffix}"),
        )
    ).all()

    if not candidates:
        return None

    new_hash = _sha256_file(new_path)

    for up in candidates:
        try:
            p = Path(up.stored_path)
            if not p.exists():
                continue
            if p.suffix.lower() != suffix:
                continue
            if p.stat().st_size != new_size:
                continue

            old_hash = _sha256_file(p)
            if old_hash == new_hash:
                # Βρες document για αυτό το upload
                doc = session.exec(select(Document).where(Document.upload_id == up.id)).first()
                if doc:
                    # Σβήσε το νέο αρχείο (δεν θα το γράψουμε στη DB)
                    try:
                        new_path.unlink(missing_ok=True)
                    except Exception:
                        pass
                    return (up.id, doc.id)
        except Exception:
            continue

    return None


# -----------------------------
# Routes
# -----------------------------
@router.get("/uploads", response_model=List[UploadListItem])
def list_uploads(
    user: User = Depends(get_current_user),
):
    with Session(engine) as session:
        uploads = session.exec(
            select(Upload).where(Upload.user_id == user.id).order_by(Upload.id.desc())
        ).all()

        out: list[UploadListItem] = []
        for up in uploads:
            doc = session.exec(select(Document).where(Document.upload_id == up.id)).first()
            if not doc:
                continue
            out.append(
                UploadListItem(
                    uploadId=up.id,
                    documentId=doc.id,
                    filename=up.filename,
                    sizeBytes=up.size_bytes,
                    contentType=up.content_type,
                )
            )
        return out


@router.post("/upload", response_model=UploadOut)
async def upload(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    upload_dir: Path = settings.AIORG_UPLOAD_DIR
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = _safe_filename(file.filename)
    target = _unique_path(upload_dir, safe_name)

    # 1) Save file to disk (streaming)
    try:
        with target.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store file: {e}")
    finally:
        try:
            file.file.close()
        except Exception:
            pass

    size_bytes = target.stat().st_size

    with Session(engine) as session:
        # 2) DEDUPE before inserting DB rows
        dedupe_hit = _dedupe_if_exists(
            session=session,
            user_id=user.id,
            new_path=target,
            new_size=size_bytes,
            safe_name=safe_name,
        )
        if dedupe_hit:
            upload_id, document_id = dedupe_hit
            # βρίσκουμε sourceType για UI (nice-to-have)
            doc = session.exec(select(Document).where(Document.id == document_id)).first()
            return UploadOut(
                uploadId=upload_id,
                documentId=document_id,
                sourceType=(doc.source_type if doc else "unknown"),
                filename=safe_name,
                deduped=True,
            )

        # 3) Insert Upload
        up = Upload(
            filename=target.name,
            content_type=file.content_type or "application/octet-stream",
            size_bytes=size_bytes,
            stored_path=str(target),
            user_id=user.id,
        )
        session.add(up)
        session.commit()
        session.refresh(up)

        # 4) Parse into Document
        ext = target.suffix.lower()
        raw_text = ""
        source_type = "unknown"

        if ext in [".txt", ".md"]:
            raw_text = read_text_file(target)
            source_type = "text" if ext == ".txt" else "md"

        elif ext == ".json":
            source_type = "chatgpt_json"
            try:
                raw = read_text_file(target)
                raw_text = parse_chatgpt_export_json(raw)
            except Exception as e:
                source_type = "chatgpt_json_parse_error"
                raw_text = f"[PARSE ERROR] {target.name}\nError: {type(e).__name__}: {e}"

        elif ext == ".docx":
            source_type = "docx"
            try:
                raw_text = read_docx_file(target)
            except Exception as e:
                source_type = "docx_parse_error"
                raw_text = f"[PARSE ERROR] {target.name}\nError: {type(e).__name__}: {e}"

        else:
            raw_text = f"[UNPARSED FILE] {target.name} ({file.content_type})"
            source_type = "binary_pending"

        doc = Document(
            upload_id=up.id,
            title=target.name,
            source_type=source_type,
            text=raw_text,
            user_id=user.id,
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)

        return UploadOut(
            uploadId=up.id,
            documentId=doc.id,
            sourceType=doc.source_type,
            filename=up.filename,
            deduped=False,
        )
