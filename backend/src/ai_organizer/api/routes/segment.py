from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, delete

from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, Segment, User
from ai_organizer.ingest.segmenters import segment_qa, segment_paragraphs

router = APIRouter()


@router.post("/documents/{document_id}/segment")
def segment_document(
    document_id: int,
    mode: str = "qa",
    user: User = Depends(get_current_user),
):
    with Session(engine) as session:
        # ✅ enforce ownership
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        # ✅ IMPORTANT: delete ALL segments for this document
        # because you have UniqueConstraint(document_id, order_index)
        session.exec(delete(Segment).where(Segment.document_id == document_id))
        session.commit()

        text = doc.text or ""

        if mode == "qa":
            chunks = segment_qa(text)
        elif mode == "paragraphs":
            chunks = segment_paragraphs(text)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

        order = 0
        cursor = 0

        for ch in chunks:
            content = ch.get("content", "").strip()
            if not content:
                continue

            start = text.find(content, cursor)
            if start < 0:
                start = cursor
            end = start + len(content)
            cursor = max(cursor, end)

            seg = Segment(
                document_id=document_id,
                order_index=order,
                mode=mode,
                title=ch.get("title", f"Segment #{order+1}"),
                content=content,
                start_char=start,
                end_char=end,
            )
            session.add(seg)
            order += 1

        session.commit()

    return {"ok": True, "documentId": document_id, "mode": mode, "segments": order}


@router.get("/documents/{document_id}/segments")
def list_segments(
    document_id: int,
    mode: str | None = None,
    user: User = Depends(get_current_user),
):
    with Session(engine) as session:
        # ✅ enforce ownership
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        stmt = select(Segment).where(Segment.document_id == document_id)

        # optional mode filter
        if mode:
            stmt = stmt.where(Segment.mode == mode)

        stmt = stmt.order_by(Segment.order_index)
        items = session.exec(stmt).all()

        return [
            {
                "id": s.id,
                "orderIndex": s.order_index,
                "mode": s.mode,
                "title": s.title,
                "content": s.content,
                "start": s.start_char,
                "end": s.end_char,
            }
            for s in items
        ]
