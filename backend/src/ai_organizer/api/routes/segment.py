# backend/src/ai_organizer/api/routes/segment.py
from __future__ import annotations

from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, delete, select

from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.core.db import engine
from ai_organizer.ingest.segmenters import segment_paragraphs, segment_qa
from ai_organizer.models import Document, Segment, User

router = APIRouter()


class SegmentMode(str, Enum):
    qa = "qa"
    paragraphs = "paragraphs"


AUTO_MODES = {SegmentMode.qa, SegmentMode.paragraphs}
ALL_MODES = {SegmentMode.qa, SegmentMode.paragraphs}


def _scalar(val):
    if isinstance(val, tuple) and len(val) == 1:
        return val[0]
    return val


class ManualSegmentIn(BaseModel):
    mode: SegmentMode = SegmentMode.qa
    start: int
    end: int
    title: str | None = None


class SegmentPatchIn(BaseModel):
    title: str | None = None
    start: int | None = None
    end: int | None = None
    content: str | None = None


@router.post("/documents/{document_id}/segment")
def segment_document(
    document_id: int,
    mode: SegmentMode = SegmentMode.qa,
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

        # keep MANUAL segments for this doc+mode
        manual_items = session.exec(
            select(Segment)
            .where(
                Segment.document_id == document_id,
                Segment.mode == mode.value,
                Segment.is_manual == True,
            )
            .order_by(Segment.order_index.asc(), Segment.id.asc())
        ).all()

        # delete only AUTO segments for this mode
        session.exec(
            delete(Segment).where(
                Segment.document_id == document_id,
                Segment.mode == mode.value,
                Segment.is_manual == False,
            )
        )
        session.commit()

        text = doc.text or ""
        chunks = segment_qa(text) if mode == SegmentMode.qa else segment_paragraphs(text)

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
                mode=mode.value,
                title=ch.get("title") or f"Chunk #{order + 1}",
                content=content,
                start_char=start,
                end_char=end,
                is_manual=False,
            )
            session.add(seg)
            order += 1
            created += 1

        session.commit()

        # reindex manual after autos
        if manual_items:
            for i, s in enumerate(manual_items):
                s.order_index = order + i
                session.add(s)
            session.commit()

    return {"ok": True, "documentId": document_id, "mode": mode.value, "count": created}


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

        # append at end
        last_row = session.exec(
            select(func.max(Segment.order_index)).where(
                Segment.document_id == document_id,
                Segment.mode == payload.mode.value,
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
            mode=payload.mode.value,
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


@router.patch("/segments/{segment_id}")
def patch_segment(
    segment_id: int,
    payload: SegmentPatchIn,
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

        doc = session.exec(
            select(Document).where(Document.id == seg.document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        text = doc.text or ""

        if payload.title is not None:
            seg.title = payload.title.strip()

        start = payload.start
        end = payload.end

        if (start is None) ^ (end is None):
            raise HTTPException(status_code=400, detail="Provide both start and end (or neither).")

        if start is not None and end is not None:
            start = int(start)
            end = int(end)
            if start < 0 or end < 0 or start >= len(text) or end > len(text) or end <= start:
                raise HTTPException(status_code=400, detail="Invalid start/end")

            seg.start_char = start
            seg.end_char = end

            if payload.content is None:
                seg.content = text[start:end]

        if payload.content is not None:
            seg.content = payload.content

        session.add(seg)
        session.commit()
        session.refresh(seg)

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


@router.get("/documents/{document_id}/segments")
def list_segments(
    document_id: int,
    mode: SegmentMode | None = None,
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    pageSize: int = Query(default=100, ge=1, le=500, description="Items per page (max 500)"),
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
        meta_stmt = select(
            func.count(Segment.id).label("count"),
            func.max(Segment.created_at).label("last_run"),
        ).where(Segment.document_id == document_id)

        if mode:
            stmt = stmt.where(Segment.mode == mode.value)
            meta_stmt = meta_stmt.where(Segment.mode == mode.value)
            stmt = stmt.order_by(Segment.order_index.asc(), Segment.id.asc())
        else:
            stmt = stmt.order_by(Segment.mode.asc(), Segment.order_index.asc(), Segment.id.asc())

        # Get total count
        meta_row = session.exec(meta_stmt).one()
        total = int(_scalar(meta_row[0]) or 0)
        last_run = meta_row[1]

        # Apply pagination
        offset = (page - 1) * pageSize
        items = session.exec(stmt.offset(offset).limit(pageSize)).all()

        return {
            "items": [
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
            ],
            "meta": {
                "count": total,
                "mode": (mode.value if mode else "all"),
                "lastRun": (last_run.isoformat() if last_run else None),  # ✅ camelCase for consistency
            },
            "pagination": {
                "total": total,
                "page": page,
                "pageSize": pageSize,
                "totalPages": (total + pageSize - 1) // pageSize if total > 0 else 0,
            },
        }


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
            .order_by(Segment.mode.asc())
        ).all()

        return [
            {"mode": m, "count": c, "lastSegmentedAt": (last.isoformat() if last else None)}
            for (m, c, last) in rows
        ]


@router.delete("/documents/{document_id}/segments")
def delete_segments(
    document_id: int,
    mode: SegmentMode | None = Query(default=None),
    include_manual: bool = Query(default=False),
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

        stmt = delete(Segment).where(Segment.document_id == document_id)
        if mode:
            stmt = stmt.where(Segment.mode == mode.value)

        if not include_manual:
            stmt = stmt.where(Segment.is_manual == False)

        res = session.exec(stmt)
        session.commit()

        return {
            "ok": True,
            "documentId": document_id,
            "mode": (mode.value if mode else None),
            "includeManual": include_manual,
            "deleted": getattr(res, "rowcount", None),
        }
