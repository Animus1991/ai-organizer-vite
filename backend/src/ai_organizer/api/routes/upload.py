# backend/src/ai_organizer/api/routes/upload.py
from __future__ import annotations

import hashlib
import re
import shutil
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from ai_organizer.api.errors import validation_error, create_error_response
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
# Supported file types (MVP)
# -----------------------------
SUPPORTED_EXTS = {".txt", ".md", ".json", ".docx"}  # (PDF/.doc later)
UNSUPPORTED_DOC_EXTS = {".doc"}  # explicitly reject with clean message


# -----------------------------
# Response schemas
# -----------------------------
class UploadError(BaseModel):
    code: str
    message: str
    supported_extensions: List[str]


class UploadOut(BaseModel):
    uploadId: int
    documentId: int
    sourceType: str
    filename: str
    deduped: bool = False

    # ✅ new: ingest status for UX
    parseStatus: str
    parseError: Optional[str] = None
    processedPath: Optional[str] = None


class UploadListItem(BaseModel):
    uploadId: int
    documentId: int
    filename: str
    sizeBytes: int
    contentType: str

    # ✅ useful for list badges (optional but helpful)
    parseStatus: str
    parseError: Optional[str] = None


class PaginatedUploadsResponse(BaseModel):
    items: List[UploadListItem]
    total: int
    page: int
    pageSize: int


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
                doc = session.exec(select(Document).where(Document.upload_id == up.id)).first()
                if doc:
                    try:
                        new_path.unlink(missing_ok=True)
                    except Exception:
                        pass
                    return (up.id, doc.id)
        except Exception:
            continue

    return None


def _write_processed_text(upload_id: int, original_name: str, text: str) -> str:
    """
    Writes processed text ONLY when parse succeeded.
    Returns processed_path string.
    """
    processed_dir: Path = settings.AIORG_PROCESSED_DIR
    processed_dir.mkdir(parents=True, exist_ok=True)

    base = Path(original_name).stem or f"upload_{upload_id}"
    safe_base = re.sub(r"[^\w.\-]+", "_", base, flags=re.UNICODE)[:120]
    out_name = f"{upload_id}_{safe_base}.txt"
    out_path = processed_dir / out_name

    out_path.write_text(text or "", encoding="utf-8", errors="replace")
    return str(out_path)


def _fail_doc_fields(ext: str) -> tuple[str, str]:
    if ext in UNSUPPORTED_DOC_EXTS:
        return "failed", "Unsupported .doc. Please upload .docx instead."
    if ext not in SUPPORTED_EXTS:
        return "failed", f"Unsupported file type: {ext}. Supported: {', '.join(sorted(SUPPORTED_EXTS))}"
    return "failed", "Parse failed."


# -----------------------------
# Routes
# -----------------------------
@router.get("/uploads", response_model=PaginatedUploadsResponse)
def list_uploads(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    pageSize: int = Query(default=50, ge=1, le=1000, description="Items per page (max 1000)"),
    user: User = Depends(get_current_user),
):
    with Session(engine) as session:
        # Get total count
        total_stmt = select(Upload).where(Upload.user_id == user.id)
        total_uploads = session.exec(total_stmt).all()
        total = len([up for up in total_uploads if session.exec(select(Document).where(Document.upload_id == up.id)).first()])
        
        # Get paginated uploads
        offset = (page - 1) * pageSize
        uploads = session.exec(
            select(Upload)
            .where(Upload.user_id == user.id)
            .order_by(Upload.id.desc())
            .offset(offset)
            .limit(pageSize)
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
                    parseStatus=getattr(doc, "parse_status", "pending"),
                    parseError=getattr(doc, "parse_error", None),
                )
            )
        
        return PaginatedUploadsResponse(
            items=out,
            total=total,
            page=page,
            pageSize=pageSize
        )


@router.post("/upload", response_model=UploadOut)
async def upload(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if not file or not file.filename:
        raise validation_error("Missing filename", details={"field": "file"})

    # File type validation - return 422 for unsupported types
    ext = Path(file.filename).suffix.lower()
    if ext in UNSUPPORTED_DOC_EXTS:
        raise validation_error(
            "Unsupported .doc file. Please upload .docx instead.",
            details={"extension": ext, "supported_extensions": sorted(SUPPORTED_EXTS), "unsupported_extensions": list(UNSUPPORTED_DOC_EXTS)}
        )
    
    if ext not in SUPPORTED_EXTS:
        raise validation_error(
            f"Unsupported file type: {ext}",
            details={"extension": ext, "supported_extensions": sorted(SUPPORTED_EXTS)}
        )

    upload_dir: Path = settings.AIORG_UPLOAD_DIR
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = _safe_filename(file.filename)
    target = _unique_path(upload_dir, safe_name)

    # 1) Save file to disk (streaming)
    try:
        with target.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    except Exception as e:
        raise create_error_response(
            code="internal_server_error",
            message=f"Failed to store file: {str(e)}",
            status_code=500,
            details={"filename": file.filename, "error": str(e)}
        )
    finally:
        try:
            file.file.close()
        except Exception:
            pass

    size_bytes = target.stat().st_size
    ext = target.suffix.lower()

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
            doc = session.exec(select(Document).where(Document.id == document_id)).first()

            return UploadOut(
                uploadId=upload_id,
                documentId=document_id,
                sourceType=(doc.source_type if doc else "unknown"),
                filename=safe_name,
                deduped=True,
                parseStatus=(doc.parse_status if doc else "pending"),
                parseError=(doc.parse_error if doc else None),
                processedPath=(doc.processed_path if doc else None),
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

        # 4) Parse into Document (clean status & errors)
        raw_text = ""
        source_type = "unknown"
        parse_status = "pending"
        parse_error: Optional[str] = None
        processed_path: Optional[str] = None

        # Supported types only (unsupported files already rejected above)
        try:
            if ext in [".txt", ".md"]:
                raw_text = read_text_file(target)
                source_type = "text" if ext == ".txt" else "md"

            elif ext == ".json":
                source_type = "chatgpt_json"
                raw = read_text_file(target)
                raw_text = parse_chatgpt_export_json(raw)

            elif ext == ".docx":
                source_type = "docx"
                raw_text = read_docx_file(target)

            # If we reached here without exception -> ok
            parse_status = "ok"
            parse_error = None
            processed_path = _write_processed_text(up.id, target.name, raw_text)

        except Exception as e:
            parse_status = "failed"
            parse_error = f"{type(e).__name__}: {e}"
            processed_path = None
            raw_text = ""  # ✅ do NOT mix errors into text

        doc = Document(
            upload_id=up.id,
            title=target.name,
            source_type=source_type,
            text=raw_text,
            user_id=user.id,
            parse_status=parse_status,
            parse_error=parse_error,
            processed_path=processed_path,
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
            parseStatus=doc.parse_status,
            parseError=doc.parse_error,
            processedPath=doc.processed_path,
        )
