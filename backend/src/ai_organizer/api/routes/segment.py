# backend/src/ai_organizer/api/routes/segment.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlmodel import Session, select, delete
from sqlalchemy import func

from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, Segment, User
from ai_organizer.ingest.segmenters import segment_qa, segment_paragraphs

router = APIRouter()

ALLOWED_MODES = {"qa", "paragraphs"}


@router.post("/documents/{document_id}/segment")
def segment_document(
    document_id: int,
    mode: str = "qa",
    user: User = Depends(get_current_user),
):
    if mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        # delete only this mode
        session.exec(delete(Segment).where(Segment.document_id == document_id, Segment.mode == mode))
        session.commit()

        text = doc.text or ""
        chunks = segment_qa(text) if mode == "qa" else segment_paragraphs(text)

        order = 0

        for ch in chunks:
            raw_content = (ch.get("content") or "")
            content = raw_content.strip()
            if not content:
                continue

            start = ch.get("start")
            end = ch.get("end")

            # ✅ HARD guarantee: start/end must exist (segmenter must provide them)
            if not (isinstance(start, int) and isinstance(end, int)):
                raise HTTPException(status_code=500, detail="Segmenter did not provide start/end")
            if start < 0:
                start = 0
            if end > len(text):
                end = len(text)
            if end < start:
                end = start

            seg = Segment(
                document_id=document_id,
                order_index=order,
                mode=mode,
                title=ch.get("title") or f"Segment #{order+1}",
                content=content,
                start_char=start,
                end_char=end,
            )
            session.add(seg)
            order += 1

        session.commit()

    return {"ok": True, "documentId": document_id, "mode": mode, "count": order}


@router.get("/documents/{document_id}/segments")
def list_segments(
    document_id: int,
    mode: str | None = None,
    user: User = Depends(get_current_user),
):
    if mode is not None and mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        stmt = select(Segment).where(Segment.document_id == document_id)
        if mode:
            stmt = stmt.where(Segment.mode == mode)

        items = session.exec(stmt.order_by(Segment.order_index)).all()

        return [
            {
                "id": s.id,
                "orderIndex": s.order_index,
                "mode": s.mode,
                "title": s.title,
                "content": s.content,
                "start": s.start_char,
                "end": s.end_char,
                "createdAt": (s.created_at.isoformat() if getattr(s, "created_at", None) else None),
            }
            for s in items
        ]


@router.get("/segments/{segment_id}")
def get_segment(
    segment_id: int,
    user: User = Depends(get_current_user),
):
    with Session(engine) as session:
        seg = session.exec(
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == segment_id, Document.user_id == user.id)
        ).first()

        if not seg:
            raise HTTPException(status_code=404, detail="Segment not found")

        return {
            "id": seg.id,
            "documentId": seg.document_id,
            "orderIndex": seg.order_index,
            "mode": seg.mode,
            "title": seg.title,
            "content": seg.content,
            "start": seg.start_char,
            "end": seg.end_char,
            "createdAt": (seg.created_at.isoformat() if getattr(seg, "created_at", None) else None),
        }


@router.get("/documents/{document_id}/segmentations")
def list_segmentations(
    document_id: int,
    user: User = Depends(get_current_user),
):
    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        rows = session.exec(
            select(
                Segment.mode,
                func.count(Segment.id).label("count"),
                func.max(Segment.created_at).label("last"),
            )
            .where(Segment.document_id == document_id)
            .group_by(Segment.mode)
            .order_by(Segment.mode)
        ).all()

        return [
            {"mode": m, "count": c, "lastSegmentedAt": (last.isoformat() if last else None)}
            for (m, c, last) in rows
        ]


@router.delete("/documents/{document_id}/segments")
def delete_segments(
    document_id: int,
    mode: str | None = Query(default=None),  # qa | paragraphs | None (all)
    user: User = Depends(get_current_user),
):
    if mode is not None and mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        stmt = delete(Segment).where(Segment.document_id == document_id)
        if mode:
            stmt = stmt.where(Segment.mode == mode)

        res = session.exec(stmt)
        session.commit()

        return {
            "ok": True,
            "documentId": document_id,
            "mode": mode,
            "deleted": getattr(res, "rowcount", None),
        }
