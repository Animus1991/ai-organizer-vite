# backend/src/ai_organizer/api/routes/documents.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, User

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

        return {
            "id": doc.id,
            "text": doc.text or "",
            "filename": getattr(doc, "filename", None),
        }
