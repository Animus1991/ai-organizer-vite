# backend/src/ai_organizer/api/routes/documents.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, Upload, User

router = APIRouter()


@router.get("/documents/{document_id}")
def get_document(
    document_id: int,
    user: User = Depends(get_current_user),
):
    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        up = session.exec(
            select(Upload).where(Upload.id == doc.upload_id, Upload.user_id == user.id)
        ).first()

        filename = up.filename if up else doc.title

        return {
            "id": doc.id,
            "title": doc.title,
            "filename": filename,
            "source_type": doc.source_type,
            "text": doc.text or "",

            # ✅ critical ingest state
            "parse_status": doc.parse_status,
            "parse_error": doc.parse_error,
            "processed_path": doc.processed_path,

            # ✅ optional upload metadata (useful for UI)
            "upload": {
                "id": up.id if up else None,
                "content_type": up.content_type if up else None,
                "size_bytes": up.size_bytes if up else None,
                "stored_path": up.stored_path if up else None,
            },
        }
