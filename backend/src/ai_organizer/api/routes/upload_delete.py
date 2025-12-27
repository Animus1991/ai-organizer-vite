from __future__ import annotations

import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import delete as sa_delete

from ai_organizer.api.routes.auth import get_current_user


# --------- engine import (πάρε το από εκεί που υπάρχει πραγματικά) ----------
try:
    # το πιο πιθανό στο project σου
    from ai_organizer.core.db import engine  # type: ignore
except Exception:  # pragma: no cover
    # fallback αν το έχεις αλλού
    from ai_organizer.db import engine  # type: ignore


# --------- models import (στο project σου φαίνεται να είναι ai_organizer/models.py) ----------
try:
    from ai_organizer.models import Upload, Document, Segment, User  # type: ignore
except Exception:  # pragma: no cover
    # fallback αν κάπου τα έχεις σε core/models.py
    from ai_organizer.core.models import Upload, Document, Segment, User  # type: ignore


# --------- DATA_DIR (για να μη “χαθείς” σε root/data vs backend/data) ----------
# Προτεραιότητα: env var. Αν δεν υπάρχει, default -> backend/data (με βάση τη δομή backend/src/ai_organizer/...)
DEFAULT_DATA_DIR = (Path(__file__).resolve().parents[5] / "data").resolve()
DATA_DIR = Path(os.getenv("AIORG_DATA_DIR", str(DEFAULT_DATA_DIR))).resolve()

router = APIRouter()


def _resolve_stored_path(stored_path: str) -> Path:
    """
    Αν η DB έχει absolute path -> το χρησιμοποιεί.
    Αν έχει relative -> το δένει πάνω στο DATA_DIR.
    """
    stored_path = (stored_path or "").strip()
    p = Path(stored_path)

    if not stored_path:
        return Path()

    if p.is_absolute():
        return p

    # relative like "uploads/file.docx" or "data/uploads/file.docx"
    if "/" in stored_path or "\\" in stored_path:
        return (DATA_DIR / p).resolve()

    # just filename
    return (DATA_DIR / "uploads" / stored_path).resolve()


def _delete_by_upload_id(upload_id: int, user_id: int) -> dict:
    with Session(engine) as session:
        up = session.exec(
            select(Upload).where(Upload.id == upload_id, Upload.user_id == user_id)
        ).first()

        if not up:
            raise HTTPException(status_code=404, detail="Upload not found")

        stored_path = up.stored_path

        # Πάρε doc ids
        rows = session.exec(
            select(Document.id).where(Document.upload_id == upload_id, Document.user_id == user_id)
        ).all()

        # rows μπορεί να είναι [1,2,3] ή [(1,), (2,)] ανάλογα με setup
        doc_ids: list[int] = []
        for r in rows:
            if isinstance(r, int):
                doc_ids.append(r)
            else:
                doc_ids.append(int(getattr(r, "id", r[0])))

        # BULK delete segments
        if doc_ids:
            session.exec(sa_delete(Segment).where(Segment.document_id.in_(doc_ids)))

        # BULK delete documents
        session.exec(
            sa_delete(Document).where(Document.upload_id == upload_id, Document.user_id == user_id)
        )

        # delete upload row
        session.exec(sa_delete(Upload).where(Upload.id == upload_id, Upload.user_id == user_id))

        session.commit()

    # delete file on disk (outside transaction)
    if stored_path:
        fp = _resolve_stored_path(stored_path)
        try:
            if fp and fp.exists():
                fp.unlink()
        except Exception:
            pass

    # delete optional processed/export folders
    for did in doc_ids:
        out_dir = (DATA_DIR / "processed" / "segments" / f"doc_{did}").resolve()
        try:
            if out_dir.exists():
                shutil.rmtree(out_dir, ignore_errors=True)
        except Exception:
            pass

    return {"ok": True, "deleted_upload_id": upload_id, "deleted_documents": doc_ids}


def _delete_by_document_id(document_id: int, user_id: int) -> dict:
    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user_id)
        ).first()

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        upload_id = doc.upload_id

        session.exec(sa_delete(Segment).where(Segment.document_id == document_id))
        session.exec(sa_delete(Document).where(Document.id == document_id, Document.user_id == user_id))
        session.commit()

    out_dir = (DATA_DIR / "processed" / "segments" / f"doc_{document_id}").resolve()
    try:
        if out_dir.exists():
            shutil.rmtree(out_dir, ignore_errors=True)
    except Exception:
        pass

    return {"ok": True, "deleted_document_id": document_id, "upload_id": upload_id}


@router.delete("/uploads/{upload_id}")
def delete_upload(upload_id: int, current_user: User = Depends(get_current_user)):
    return _delete_by_upload_id(upload_id=upload_id, user_id=current_user.id)


@router.delete("/documents/{document_id}")
def delete_document(document_id: int, current_user: User = Depends(get_current_user)):
    return _delete_by_document_id(document_id=document_id, user_id=current_user.id)
