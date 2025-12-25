from __future__ import annotations

import re
import shutil
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from sqlmodel import Session

from ai_organizer.core.config import settings
from ai_organizer.core.db import engine
from ai_organizer.models import Upload, Document, User
from ai_organizer.ingest.parsers import read_text_file, parse_chatgpt_export_json
from ai_organizer.core.auth_dep import get_current_user

router = APIRouter()


def _safe_filename(name: str) -> str:
    name = (name or "").strip()
    # κρατάει γράμματα/νούμερα/._- και αντικαθιστά τα υπόλοιπα με _
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


@router.post("/upload")
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

    # ✅ Αποθήκευση με streaming (όχι await file.read() όλο στη RAM)
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

    # DB work
    with Session(engine) as session:
        up = Upload(
            filename=target.name,
            content_type=file.content_type or "application/octet-stream",
            size_bytes=size_bytes,
            stored_path=str(target),
            user_id=user.id,  # ✅ πρόσθεσε αυτό
        )
        session.add(up)
        session.commit()
        session.refresh(up)

        ext = target.suffix.lower()
        raw_text = ""
        source_type = "unknown"

        if ext in [".txt", ".md"]:
            raw_text = read_text_file(target)
            source_type = "text" if ext == ".txt" else "md"
        elif ext == ".json":
            source_type = "chatgpt_json"
            try:
                raw_text = read_text_file(target)
                raw_text = parse_chatgpt_export_json(raw_text)
            except Exception as e:
                source_type = "chatgpt_json_parse_error"
                raw_text = f"[PARSE ERROR] {target.name}\nError: {type(e).__name__}: {e}"
        else:
            raw_text = f"[UNPARSED FILE] {target.name} ({file.content_type})"
            source_type = "binary_pending"

        doc = Document(
            upload_id=up.id,
            title=target.name,
            source_type=source_type,
            text=raw_text,
            user_id=user.id,  # ✅ πρόσθεσε αυτό
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)

        return {"uploadId": up.id, "documentId": doc.id, "sourceType": doc.source_type}
