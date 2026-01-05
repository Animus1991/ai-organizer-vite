# backend/src/ai_organizer/api/routes/documents.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, Upload, User

router = APIRouter()


class DocumentOut(BaseModel):
    id: int
    title: str
    filename: str | None = None
    sourceType: str
    text: str
    parseStatus: str
    parseError: str | None = None
    processedPath: str | None = None
    upload: dict | None = None


class DocumentPatchIn(BaseModel):
    title: str | None = None
    text: str | None = None


@router.get("/documents/{document_id}", response_model=DocumentOut)
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

        return DocumentOut(
            id=doc.id,
            title=doc.title,
            filename=filename,
            sourceType=doc.source_type,
            text=doc.text or "",
            parseStatus=doc.parse_status,
            parseError=doc.parse_error,
            processedPath=doc.processed_path,
            upload={
                "id": up.id if up else None,
                "content_type": up.content_type if up else None,
                "size_bytes": up.size_bytes if up else None,
                "stored_path": up.stored_path if up else None,
            },
        )


@router.patch("/documents/{document_id}", response_model=DocumentOut)
def patch_document(
    document_id: int,
    payload: DocumentPatchIn,
    user: User = Depends(get_current_user),
):
    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        if payload.title is not None:
            doc.title = payload.title

        if payload.text is not None:
            doc.text = payload.text

        session.add(doc)
        session.commit()
        session.refresh(doc)

        up = session.exec(
            select(Upload).where(Upload.id == doc.upload_id, Upload.user_id == user.id)
        ).first()

        filename = up.filename if up else doc.title

        return DocumentOut(
            id=doc.id,
            title=doc.title,
            filename=filename,
            sourceType=doc.source_type,
            text=doc.text or "",
            parseStatus=doc.parse_status,
            parseError=doc.parse_error,
            processedPath=doc.processed_path,
            upload={
                "id": up.id if up else None,
                "content_type": up.content_type if up else None,
                "size_bytes": up.size_bytes if up else None,
                "stored_path": up.stored_path if up else None,
            },
        )
