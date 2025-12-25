from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, delete
from ai_organizer.core.db import engine
from ai_organizer.models import Document, Segment
from ai_organizer.ingest.segmenters import segment_qa, segment_paragraphs
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import User

router = APIRouter()

@router.post("/documents/{document_id}/segment")
def segment_document(document_id: int, mode: str = "qa", user: User = Depends(get_current_user)):
    with Session(engine) as session:
        doc = session.get(Document, document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        # καθαρίζουμε παλιά segments αυτού του mode (ώστε να μπορείς να ξανατρέχεις)
        session.exec(delete(Segment).where(Segment.document_id == document_id).where(Segment.mode == mode))

        if mode == "qa":
            chunks = segment_qa(doc.text)
        elif mode == "paragraphs":
            chunks = segment_paragraphs(doc.text)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

        # save
        order = 0
        cursor = 0
        for ch in chunks:
            content = ch["content"]
            start = doc.text.find(content, cursor)
            if start < 0:
                start = cursor
            end = start + len(content)
            cursor = max(cursor, end)

            seg = Segment(
                document_id=document_id,
                order_index=order,
                mode=mode,
                title=ch.get("title", ""),
                content=content,
                start_char=start,
                end_char=end,
            )
            session.add(seg)
            order += 1

        session.commit()

    return {"ok": True, "documentId": document_id, "mode": mode, "segments": order}

@router.get("/documents/{document_id}/segments")
def list_segments(document_id: int, mode: str = "qa"):
    with Session(engine) as session:
        stmt = select(Segment).where(Segment.document_id == document_id).where(Segment.mode == mode).order_by(Segment.order_index)
        items = session.exec(stmt).all()
        return [{
            "id": s.id,
            "order": s.order_index,
            "title": s.title,
            "content": s.content,
            "start": s.start_char,
            "end": s.end_char,
        } for s in items]
