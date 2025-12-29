from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, select, delete
from sqlalchemy import func

from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, Segment, User
from ai_organizer.ingest.segmenters import segment_qa, segment_paragraphs

router = APIRouter()

AUTO_MODES = {"qa", "paragraphs"}
ALL_MODES = {"qa", "paragraphs"}  # δεν υπάρχει "manual" mode


def _scalar(val):
    # defensive: in some result shapes you may get (x,) instead of x
    if isinstance(val, tuple) and len(val) == 1:
        return val[0]
    return val


class ManualSegmentIn(BaseModel):
    mode: str = "qa"  # qa | paragraphs
    start: int
    end: int
    title: str | None = None


@router.post("/documents/{document_id}/segment")
def segment_document(
    document_id: int,
    mode: str = "qa",
    user: User = Depends(get_current_user),
):
    if mode not in AUTO_MODES:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        # Load manual segments for this document+mode (we will keep them)
        manual_items = session.exec(
            select(Segment)
            .where(
                Segment.document_id == document_id,
                Segment.mode == mode,
                Segment.is_manual == True,
            )
            .order_by(Segment.order_index)
        ).all()

        # Delete only AUTO segments for this mode
        session.exec(
            delete(Segment).where(
                Segment.document_id == document_id,
                Segment.mode == mode,
                Segment.is_manual == False,
            )
        )
        session.commit()

        text = doc.text or ""
        chunks = segment_qa(text) if mode == "qa" else segment_paragraphs(text)

        # Recreate AUTO segments starting at 0
        order = 0
        created = 0

        for ch in chunks:
            raw_content = (ch.get("content") or "")
            content = raw_content.strip()
            if not content:
                continue

            start = ch.get("start")
            end = ch.get("end")
            if not (isinstance(start, int) and isinstance(end, int)):
                raise HTTPException(status_code=500, detail="Segmenter did not provide start/end")

            start = max(0, start)
            end = min(len(text), end)
            if end < start:
                end = start

            seg = Segment(
                document_id=document_id,
                order_index=order,
                mode=mode,
                title=ch.get("title") or f"Segment #{order + 1}",
                content=content,
                start_char=start,
                end_char=end,
                is_manual=False,
            )
            session.add(seg)
            order += 1
            created += 1

        session.commit()

        # Reindex manual segments to come after autos (keeps manual, no delete)
        # This avoids unbounded order_index growth and keeps list readable.
        if manual_items:
            for i, s in enumerate(manual_items):
                s.order_index = order + i
                session.add(s)
            session.commit()

    return {"ok": True, "documentId": document_id, "mode": mode, "count": created}


@router.post("/documents/{document_id}/segments/manual")
def create_manual_segment(
    document_id: int,
    payload: ManualSegmentIn,
    user: User = Depends(get_current_user),
):
    if payload.mode not in AUTO_MODES:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {payload.mode}")

    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        text = doc.text or ""
        start = int(payload.start)
        end = int(payload.end)

        if start < 0 or end < 0 or start >= len(text) or end > len(text) or end <= start:
            raise HTTPException(status_code=400, detail="Invalid start/end")

        content = text[start:end]

        # append at end of this document+mode list
        last_row = session.exec(
            select(func.max(Segment.order_index)).where(
                Segment.document_id == document_id,
                Segment.mode == payload.mode,
            )
        ).one()
        last = _scalar(last_row)
        next_order = (last if isinstance(last, int) else -1) + 1

        title = (payload.title or "").strip()
        if not title:
            title = f"Manual #{next_order + 1}"

        seg = Segment(
            document_id=document_id,
            order_index=next_order,
            mode=payload.mode,
            title=title,
            content=content,
            start_char=start,
            end_char=end,
            is_manual=True,
        )
        session.add(seg)
        session.commit()
        session.refresh(seg)

        return {
            "id": seg.id,
            "documentId": document_id,
            "orderIndex": seg.order_index,
            "mode": seg.mode,
            "title": seg.title,
            "content": seg.content,
            "start": seg.start_char,
            "end": seg.end_char,
            "isManual": True,
            "createdAt": (seg.created_at.isoformat() if getattr(seg, "created_at", None) else None),
        }


@router.get("/documents/{document_id}/segments")
def list_segments(
    document_id: int,
    mode: str | None = None,
    user: User = Depends(get_current_user),
):
    if mode is not None and mode not in ALL_MODES:
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

        items = session.exec(stmt.order_by(Segment.mode, Segment.order_index)).all()

        return [
            {
                "id": s.id,
                "orderIndex": s.order_index,
                "mode": s.mode,
                "title": s.title,
                "content": s.content,
                "start": s.start_char,
                "end": s.end_char,
                "isManual": bool(getattr(s, "is_manual", False)),
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
            "isManual": bool(getattr(seg, "is_manual", False)),
            "createdAt": (seg.created_at.isoformat() if getattr(seg, "created_at", None) else None),
        }


@router.delete("/segments/{segment_id}")
def delete_one_segment(
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

        session.delete(seg)
        session.commit()
        return {"ok": True, "deletedId": segment_id}


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
    mode: str | None = Query(default=None),
    include_manual: bool = Query(default=False),
    user: User = Depends(get_current_user),
):
    """
    Deletes segments for a document.
    - If mode provided, deletes only that mode.
    - By default keeps manual segments (include_manual=false).
    - If you really want to delete manual too, set include_manual=true.
    """
    if mode is not None and mode not in ALL_MODES:
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

        if not include_manual:
            stmt = stmt.where(Segment.is_manual == False)

        res = session.exec(stmt)
        session.commit()

        return {
            "ok": True,
            "documentId": document_id,
            "mode": mode,
            "includeManual": include_manual,
            "deleted": getattr(res, "rowcount", None),
        }
