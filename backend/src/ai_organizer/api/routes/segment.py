# backend/src/ai_organizer/api/routes/segment.py
from __future__ import annotations

from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, delete, select
from sqlalchemy import inspect

from ai_organizer.api.errors import not_found, validation_error, create_error_response, bad_request
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.core.db import engine
from ai_organizer.ingest.segmenters import segment_paragraphs, segment_qa
from ai_organizer.models import Document, Segment, User, SegmentType, EvidenceGrade, SegmentLink, LinkType

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


# P2: Helper function to check if P2 research fields exist in database
def _has_p2_fields() -> bool:
    """Check if P2 research fields (segment_type, evidence_grade, falsifiability_criteria) exist in segments table"""
    try:
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('segments')]
        required_fields = {'segment_type', 'evidence_grade', 'falsifiability_criteria'}
        return all(field in columns for field in required_fields)
    except Exception:
        # If inspection fails, assume fields don't exist (safe fallback)
        return False


# P2: Helper function to safely get P2 field values from a segment
def _get_segment_p2_field(seg: Segment, field_name: str, default_value=None):
    """Safely get P2 field value from segment, with graceful fallback if column doesn't exist"""
    if not _has_p2_fields():
        return default_value
    try:
        return getattr(seg, field_name, default_value)
    except (OperationalError, AttributeError, Exception):
        # Column doesn't exist or query failed - return default
        return default_value


# P3: Helper function to check if deleted_at column exists
def _has_p3_soft_delete_fields() -> bool:
    """Check if P3 soft delete columns (deleted_at) exist in tables"""
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        
        if "documents" not in tables or "segments" not in tables:
            return False
        
        # Check if deleted_at column exists in documents and segments tables
        doc_cols = [c["name"] for c in inspector.get_columns("documents")]
        seg_cols = [c["name"] for c in inspector.get_columns("segments")]
        return "deleted_at" in doc_cols and "deleted_at" in seg_cols
    except Exception:
        # If inspection fails, assume fields don't exist (safe fallback)
        return False


class ManualSegmentIn(BaseModel):
    mode: SegmentMode = SegmentMode.qa
    start: int
    end: int
    title: str | None = None


class SegmentPatchIn(BaseModel):
    """PATCH payload for updating segment content and research-grade fields"""
    title: str | None = None
    start: int | None = None
    end: int | None = None
    content: str | None = None
    # P2: Research-Grade Fields
    segmentType: str | None = None  # camelCase for API consistency
    evidenceGrade: str | None = None  # camelCase: E0, E1, E2, E3, E4
    falsifiabilityCriteria: str | None = None  # camelCase: text field


@router.post("/documents/{document_id}/segment")
def segment_document(
    document_id: int,
    mode: SegmentMode = SegmentMode.qa,
    user: User = Depends(get_current_user),
):
    if mode not in AUTO_MODES:
        raise validation_error(f"Unknown mode: {mode}", details={"mode": mode.value if hasattr(mode, 'value') else str(mode), "valid_modes": [m.value for m in AUTO_MODES]})

    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(
                Document.id == document_id,
                Document.user_id == user.id,
                Document.deleted_at.is_(None)  # P3: Filter out soft-deleted documents
            )
        ).first()
        if not doc:
            raise not_found("Document", str(document_id))

        # keep MANUAL segments for this doc+mode
        manual_items = session.exec(
            select(Segment)
            .where(
                Segment.document_id == document_id,
                Segment.mode == mode.value,
                Segment.is_manual == True,
                Segment.deleted_at.is_(None)  # P3: Filter out soft-deleted segments
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
                from ai_organizer.api.errors import internal_server_error
                raise internal_server_error(
                    "Segmenter did not provide start/end",
                    details={"chunk": ch}
                )

            start = max(0, start)
            end = min(len(text), end)
            if end < start:
                end = start

            # P2: Only set segment_type if columns exist (graceful fallback)
            seg_kwargs = {
                "document_id": document_id,
                "order_index": order,
                "mode": mode.value,
                "title": ch.get("title") or f"Chunk #{order + 1}",
                "content": content,
                "start_char": start,
                "end_char": end,
                "is_manual": False,
            }
            if _has_p2_fields():
                seg_kwargs["segment_type"] = SegmentType.UNTYPED.value
            
            seg = Segment(**seg_kwargs)
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
        raise validation_error(f"Unknown mode: {payload.mode}", details={"mode": payload.mode.value if hasattr(payload.mode, 'value') else str(payload.mode), "valid_modes": [m.value for m in AUTO_MODES]})

    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise not_found("Document", str(document_id))

        text = doc.text or ""
        start = int(payload.start)
        end = int(payload.end)

        if start < 0 or end < 0 or start >= len(text) or end > len(text) or end <= start:
            raise validation_error("Invalid start/end", details={"start": start, "end": end, "text_length": len(text)})

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

        # P2: Only set segment_type if columns exist (graceful fallback)
        seg_kwargs = {
            "document_id": document_id,
            "order_index": next_order,
            "mode": payload.mode.value,
            "title": title,
            "content": content,
            "start_char": start,
            "end_char": end,
            "is_manual": True,
        }
        if _has_p2_fields():
            seg_kwargs["segment_type"] = SegmentType.UNTYPED.value
        
        seg = Segment(**seg_kwargs)
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
            # P2: Research-Grade Fields (graceful fallback if columns don't exist)
            "segmentType": _get_segment_p2_field(seg, "segment_type", SegmentType.UNTYPED.value),
            "evidenceGrade": _get_segment_p2_field(seg, "evidence_grade", None),
            "falsifiabilityCriteria": _get_segment_p2_field(seg, "falsifiability_criteria", None),
            "createdAt": (seg.created_at.isoformat() if getattr(seg, "created_at", None) else None),
        }


@router.patch("/segments/{segment_id}")
def patch_segment(
    segment_id: int,
    payload: SegmentPatchIn,
    user: User = Depends(get_current_user),
):
    """
    Update segment by ID.
    
    Architecture Invariant: Auto-generated segments are immutable.
    If segment is auto (is_manual=False), editing creates a new manual segment
    and keeps the original auto segment unchanged.
    If segment is manual (is_manual=True), editing updates in-place.
    
    This preserves re-segmentation determinism: re-segmentation restores
    original auto segments while preserving manual edits.
    """
    with Session(engine) as session:
        # Build query with P3 soft delete filtering (graceful fallback if column doesn't exist)
        base_query = (
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == segment_id, Document.user_id == user.id)
        )
        if _has_p3_soft_delete_fields():
            base_query = base_query.where(
                Document.deleted_at.is_(None),
                Segment.deleted_at.is_(None)
            )
        
        seg = session.exec(base_query).first()

        if not seg:
            raise not_found("Segment", str(segment_id))

        # Build document query with P3 soft delete filtering
        doc_query = select(Document).where(Document.id == seg.document_id, Document.user_id == user.id)
        if _has_p3_soft_delete_fields():
            doc_query = doc_query.where(Document.deleted_at.is_(None))
        
        doc = session.exec(doc_query).first()
        if not doc:
            raise not_found("Document", str(document_id))

        # Architecture Invariant: Auto segments are immutable - fork on edit
        is_manual = bool(getattr(seg, "is_manual", False))
        
        if not is_manual:
            # Auto segment - create new manual segment instead of mutating
            # Original auto segment remains unchanged for re-segmentation determinism
            
            # Get document text (original, not versioned - segmentation uses original)
            text = doc.text or ""
            
            # Determine new values (from payload or use current values)
            new_title = payload.title.strip() if payload.title is not None else seg.title
            new_start = payload.start if payload.start is not None else seg.start_char
            new_end = payload.end if payload.end is not None else seg.end_char
            
            # Validate start/end if provided
            if (payload.start is None) ^ (payload.end is None):
                raise validation_error("Provide both start and end (or neither)", details={"start_provided": payload.start is not None, "end_provided": payload.end is not None})
            
            if payload.start is not None and payload.end is not None:
                new_start = int(payload.start)
                new_end = int(payload.end)
                if new_start < 0 or new_end < 0 or new_start >= len(text) or new_end > len(text) or new_end <= new_start:
                    raise validation_error("Invalid start/end", details={"start": new_start, "end": new_end, "text_length": len(text)})
            
            # Determine content (from payload or extract from text)
            if payload.content is not None:
                new_content = payload.content
            elif payload.start is not None and payload.end is not None:
                new_content = text[new_start:new_end]
            else:
                new_content = seg.content
            
            # Get next order index (append at end)
            last_row = session.exec(
                select(func.max(Segment.order_index)).where(
                    Segment.document_id == seg.document_id,
                    Segment.mode == seg.mode,
                )
            ).one()
            last = _scalar(last_row)
            next_order = (last if isinstance(last, int) else -1) + 1
            
            # Create new manual segment (P2: only set segment_type if columns exist)
            new_seg_kwargs = {
                "document_id": seg.document_id,
                "order_index": next_order,
                "mode": seg.mode,
                "title": new_title,
                "content": new_content,
                "start_char": new_start,
                "end_char": new_end,
                "is_manual": True,  # New segment is manual (fork of auto segment)
            }
            
            # P2: Copy research-grade fields from original segment if they exist
            if _has_p2_fields():
                try:
                    if hasattr(seg, "segment_type") and seg.segment_type:
                        new_seg_kwargs["segment_type"] = seg.segment_type
                    elif payload.segmentType is not None:
                        valid_types = [t.value for t in SegmentType]
                        if payload.segmentType not in valid_types:
                            raise validation_error(
                                f"Invalid segmentType: {payload.segmentType}",
                                details={"segmentType": payload.segmentType, "validTypes": valid_types}
                            )
                        new_seg_kwargs["segment_type"] = payload.segmentType
                    else:
                        new_seg_kwargs["segment_type"] = SegmentType.UNTYPED.value
                    
                    if payload.evidenceGrade is not None:
                        valid_grades = [g.value for g in EvidenceGrade]
                        if payload.evidenceGrade not in valid_grades:
                            raise validation_error(
                                f"Invalid evidenceGrade: {payload.evidenceGrade}",
                                details={"evidenceGrade": payload.evidenceGrade, "validGrades": valid_grades}
                            )
                        new_seg_kwargs["evidence_grade"] = payload.evidenceGrade
                    elif hasattr(seg, "evidence_grade") and seg.evidence_grade:
                        new_seg_kwargs["evidence_grade"] = seg.evidence_grade
                    
                    if payload.falsifiabilityCriteria is not None:
                        new_seg_kwargs["falsifiability_criteria"] = payload.falsifiabilityCriteria
                    elif hasattr(seg, "falsifiability_criteria") and seg.falsifiability_criteria:
                        new_seg_kwargs["falsifiability_criteria"] = seg.falsifiability_criteria
                except (OperationalError, AttributeError):
                    # Columns don't exist - skip P2 fields (graceful degradation)
                    pass
            
            new_seg = Segment(**new_seg_kwargs)
            session.add(new_seg)
            session.commit()
            session.refresh(new_seg)
            
            return {
                "id": new_seg.id,
                "documentId": new_seg.document_id,
                "orderIndex": new_seg.order_index,
                "mode": new_seg.mode,
                "title": new_seg.title,
                "content": new_seg.content,
                "start": new_seg.start_char,
                "end": new_seg.end_char,
                "isManual": True,
                # P2: Research-Grade Fields (graceful fallback if columns don't exist)
                "segmentType": _get_segment_p2_field(new_seg, "segment_type", SegmentType.UNTYPED.value),
                "evidenceGrade": _get_segment_p2_field(new_seg, "evidence_grade", None),
                "falsifiabilityCriteria": _get_segment_p2_field(new_seg, "falsifiability_criteria", None),
                "createdAt": (new_seg.created_at.isoformat() if getattr(new_seg, "created_at", None) else None),
            }
        
        # Manual segment - update in-place (no fork needed)
        text = doc.text or ""

        if payload.title is not None:
            seg.title = payload.title.strip()

        start = payload.start
        end = payload.end

        if (start is None) ^ (end is None):
            raise validation_error("Provide both start and end (or neither)", details={"start_provided": start is not None, "end_provided": end is not None})

        if start is not None and end is not None:
            start = int(start)
            end = int(end)
            if start < 0 or end < 0 or start >= len(text) or end > len(text) or end <= start:
                raise validation_error("Invalid start/end", details={"start": start, "end": end, "text_length": len(text)})

            seg.start_char = start
            seg.end_char = end

            if payload.content is None:
                seg.content = text[start:end]

        if payload.content is not None:
            seg.content = payload.content
        
        # P2: Update research-grade fields if provided (only if columns exist)
        if _has_p2_fields():
            try:
                if payload.segmentType is not None:
                    # Validate segment type
                    valid_types = [t.value for t in SegmentType]
                    if payload.segmentType not in valid_types:
                        raise validation_error(
                            f"Invalid segmentType: {payload.segmentType}",
                            details={"segmentType": payload.segmentType, "validTypes": valid_types}
                        )
                    seg.segment_type = payload.segmentType
                
                if payload.evidenceGrade is not None:
                    # Validate evidence grade
                    valid_grades = [g.value for g in EvidenceGrade]
                    if payload.evidenceGrade not in valid_grades:
                        raise validation_error(
                            f"Invalid evidenceGrade: {payload.evidenceGrade}",
                            details={"evidenceGrade": payload.evidenceGrade, "validGrades": valid_grades}
                        )
                    seg.evidence_grade = payload.evidenceGrade
                
                if payload.falsifiabilityCriteria is not None:
                    seg.falsifiability_criteria = payload.falsifiabilityCriteria
            except (OperationalError, AttributeError):
                # Columns don't exist or update failed - ignore P2 fields (graceful degradation)
                pass

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
            "isManual": True,  # Manual segments are always is_manual=True
            # P2: Research-Grade Fields (graceful fallback if columns don't exist)
            "segmentType": _get_segment_p2_field(seg, "segment_type", SegmentType.UNTYPED.value),
            "evidenceGrade": _get_segment_p2_field(seg, "evidence_grade", None),
            "falsifiabilityCriteria": _get_segment_p2_field(seg, "falsifiability_criteria", None),
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
        raise validation_error(f"Unknown mode: {mode}", details={"mode": mode.value if hasattr(mode, 'value') else str(mode), "valid_modes": [m.value for m in ALL_MODES]})

    with Session(engine) as session:
        # Build query with P3 soft delete filtering (graceful fallback if column doesn't exist)
        query = select(Document).where(Document.id == document_id, Document.user_id == user.id)
        if _has_p3_soft_delete_fields():
            query = query.where(Document.deleted_at.is_(None))
        
        doc = session.exec(query).first()
        if not doc:
            raise not_found("Document", str(document_id))

        stmt = select(Segment).where(Segment.document_id == document_id)
        meta_stmt = select(
            func.count(Segment.id).label("count"),
            func.max(Segment.created_at).label("last_run"),
        ).where(Segment.document_id == document_id)
        
        # P3: Filter out soft-deleted segments
        if _has_p3_soft_delete_fields():
            stmt = stmt.where(Segment.deleted_at.is_(None))
            meta_stmt = meta_stmt.where(Segment.deleted_at.is_(None))

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
        # P2: Wrap SELECT query in try/except for graceful handling of missing columns
        try:
            items = session.exec(stmt.offset(offset).limit(pageSize)).all()
        except OperationalError as e:
            # If P2 columns don't exist, query will fail - retry with explicit column selection
            # For now, return empty list (better than crashing)
            # TODO: Run migration to add P2 columns
            items = []
            # Log warning but don't crash
            import logging
            logging.warning(f"P2 columns not found in segments table. Please run migration: `alembic upgrade head`. Error: {e}")

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
                    # P2: Research-Grade Fields (graceful fallback if columns don't exist)
                    "segmentType": _get_segment_p2_field(s, "segment_type", SegmentType.UNTYPED.value),
                    "evidenceGrade": _get_segment_p2_field(s, "evidence_grade", None),
                    "falsifiabilityCriteria": _get_segment_p2_field(s, "falsifiability_criteria", None),
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
        # P2: Wrap SELECT query in try/except for graceful handling of missing columns
        try:
            seg = session.exec(
                select(Segment)
                .join(Document, Segment.document_id == Document.id)
                .where(Segment.id == segment_id, Document.user_id == user.id)
            ).first()
        except OperationalError as e:
            # If P2 columns don't exist, query will fail - try without P2 fields
            # For now, return 500 with helpful message
            # TODO: Run migration to add P2 columns
            import logging
            logging.error(f"P2 columns not found in segments table. Please run migration: `alembic upgrade head`. Error: {e}")
            from ai_organizer.api.errors import internal_server_error
            raise internal_server_error(
                "Database schema is out of date. Please run migrations: `alembic upgrade head`",
                details={"error": str(e), "migration_command": "alembic upgrade head"}
            )

        if not seg:
            raise not_found("Segment", str(segment_id))

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
            # P2: Research-Grade Fields (graceful fallback if columns don't exist)
            "segmentType": _get_segment_p2_field(seg, "segment_type", SegmentType.UNTYPED.value),
            "evidenceGrade": _get_segment_p2_field(seg, "evidence_grade", None),
            "falsifiabilityCriteria": _get_segment_p2_field(seg, "falsifiability_criteria", None),
            "createdAt": (seg.created_at.isoformat() if getattr(seg, "created_at", None) else None),
        }


@router.delete("/segments/{segment_id}")
def delete_one_segment(
    segment_id: int,
    user: User = Depends(get_current_user),
):
    """
    Soft delete a segment (move to recycle bin).
    P3: Uses soft delete (deleted_at) instead of hard delete.
    """
    from datetime import datetime
    
    with Session(engine) as session:
        seg = session.exec(
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == segment_id, Document.user_id == user.id)
        ).first()
        if not seg:
            raise not_found("Segment", str(segment_id))
        
        # Check if already soft-deleted
        if _has_p3_soft_delete_fields() and seg.deleted_at:
            return {"ok": True, "message": "Segment already deleted", "deletedId": segment_id, "deletedAt": seg.deleted_at.isoformat()}
        
        # P3: Soft delete instead of hard delete
        if _has_p3_soft_delete_fields():
            seg.deleted_at = datetime.utcnow()
            session.commit()
            return {"ok": True, "deletedId": segment_id, "deletedAt": seg.deleted_at.isoformat()}
        else:
            # Fallback to hard delete if soft delete not available
            session.delete(seg)
            session.commit()
            return {"ok": True, "deletedId": segment_id, "hardDelete": True}


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
            raise not_found("Document", str(document_id))

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


# ============================================================================
# P2: Segment Linking Graph API Endpoints
# ============================================================================

@router.get("/segments/{segment_id}/links")
def get_segment_links(
    segment_id: int,
    user: User = Depends(get_current_user),
):
    """Get all links for a segment (both incoming and outgoing)"""
    with Session(engine) as session:
        # Verify segment ownership with P3 soft delete filtering
        base_query = (
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == segment_id, Document.user_id == user.id)
        )
        if _has_p3_soft_delete_fields():
            base_query = base_query.where(
                Document.deleted_at.is_(None),
                Segment.deleted_at.is_(None)
            )
        
        seg = session.exec(base_query).first()
        if not seg:
            raise not_found("Segment", str(segment_id))

        # Get all links where this segment is either source or target
        links = session.exec(
            select(SegmentLink)
            .join(User, SegmentLink.created_by_user_id == User.id)
            .where(
                (SegmentLink.from_segment_id == segment_id) | 
                (SegmentLink.to_segment_id == segment_id)
            )
        ).all()
        
        return [
            {
                "id": link.id,
                "fromSegmentId": link.from_segment_id,
                "toSegmentId": link.to_segment_id,
                "linkType": link.link_type,
                "notes": link.notes,
                "createdAt": link.created_at.isoformat(),
                "createdByUserId": link.created_by_user_id,
            }
            for link in links
        ]


@router.post("/segments/{from_segment_id}/links/{to_segment_id}")
def create_segment_link(
    from_segment_id: int,
    to_segment_id: int,
    link_data: dict,
    user: User = Depends(get_current_user),
):
    """Create a link between two segments"""
    with Session(engine) as session:
        # Verify both segments belong to user
        from_seg = session.exec(
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == from_segment_id, Document.user_id == user.id)
        ).first()
        to_seg = session.exec(
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == to_segment_id, Document.user_id == user.id)
        ).first()
        
        if not from_seg:
            raise not_found("Source Segment", str(from_segment_id))
        if not to_seg:
            raise not_found("Target Segment", str(to_segment_id))
        
        # Create link
        link = SegmentLink(
            from_segment_id=from_segment_id,
            to_segment_id=to_segment_id,
            link_type=link_data.get("linkType", "related"),
            notes=link_data.get("notes"),
            created_by_user_id=user.id
        )
        session.add(link)
        session.commit()
        
        return {
            "id": link.id,
            "fromSegmentId": link.from_segment_id,
            "toSegmentId": link.to_segment_id,
            "linkType": link.link_type,
            "notes": link.notes,
            "createdAt": link.created_at.isoformat(),
        }


@router.patch("/segment-links/{link_id}")
def update_segment_link(
    link_id: int,
    link_data: dict,
    user: User = Depends(get_current_user),
):
    """Update a segment link (notes or link type)"""
    with Session(engine) as session:
        link = session.exec(
            select(SegmentLink)
            .join(User, SegmentLink.created_by_user_id == User.id)
            .where(SegmentLink.id == link_id, User.id == user.id)
        ).first()
        if not link:
            raise not_found("Segment Link", str(link_id))
        
        # Update allowed fields
        if "linkType" in link_data:
            link.link_type = link_data["linkType"]
        if "notes" in link_data:
            link.notes = link_data["notes"]
        
        session.commit()
        
        return {
            "id": link.id,
            "fromSegmentId": link.from_segment_id,
            "toSegmentId": link.to_segment_id,
            "linkType": link.link_type,
            "notes": link.notes,
            "updatedAt": link.created_at.isoformat(),  # Using created_at as updated_at for simplicity
        }


@router.delete("/segment-links/{link_id}")
def delete_segment_link(
    link_id: int,
    user: User = Depends(get_current_user),
):
    """Delete a segment link"""
    with Session(engine) as session:
        link = session.exec(
            select(SegmentLink)
            .join(User, SegmentLink.created_by_user_id == User.id)
            .where(SegmentLink.id == link_id, User.id == user.id)
        ).first()
        if not link:
            raise not_found("Segment Link", str(link_id))
        
        session.delete(link)
        session.commit()
        
        return {"ok": True, "deletedId": link_id}


@router.delete("/documents/{document_id}/segments")
def delete_segments(
    document_id: int,
    mode: SegmentMode | None = Query(default=None),
    include_manual: bool = Query(default=False),
    user: User = Depends(get_current_user),
):
    if mode is not None and mode not in ALL_MODES:
        raise validation_error(f"Unknown mode: {mode}", details={"mode": mode.value if hasattr(mode, 'value') else str(mode), "valid_modes": [m.value for m in ALL_MODES]})

    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise not_found("Document", str(document_id))

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


# P2: Segment Linking Endpoints
class SegmentLinkCreateIn(BaseModel):
    """Create a link between two segments"""
    toSegmentId: int  # camelCase
    linkType: str  # camelCase: supports, contradicts, depends_on, etc.
    notes: str | None = None


@router.post("/segments/{from_segment_id}/links")
def create_segment_link(
    from_segment_id: int,
    payload: SegmentLinkCreateIn,
    user: User = Depends(get_current_user),
):
    """Create a link between two segments (Claim ↔ Evidence, etc.)"""
    with Session(engine) as session:
        # Validate both segments exist and belong to user
        from_seg = session.exec(
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == from_segment_id, Document.user_id == user.id)
        ).first()
        if not from_seg:
            raise not_found("Segment", str(from_segment_id))
        
        to_seg = session.exec(
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == payload.toSegmentId, Document.user_id == user.id)
        ).first()
        if not to_seg:
            raise not_found("Segment", str(payload.toSegmentId))
        
        # Prevent self-links
        if from_segment_id == payload.toSegmentId:
            raise bad_request("Cannot link segment to itself", details={"segmentId": from_segment_id})
        
        # Validate link type
        valid_link_types = [lt.value for lt in LinkType]
        if payload.linkType not in valid_link_types:
            raise validation_error(
                f"Invalid linkType: {payload.linkType}",
                details={"linkType": payload.linkType, "validLinkTypes": valid_link_types}
            )
        
        # Check if link already exists
        existing = session.exec(
            select(SegmentLink).where(
                SegmentLink.from_segment_id == from_segment_id,
                SegmentLink.to_segment_id == payload.toSegmentId,
                SegmentLink.link_type == payload.linkType
            )
        ).first()
        if existing:
            raise validation_error(
                "Link already exists",
                details={
                    "fromSegmentId": from_segment_id,
                    "toSegmentId": payload.toSegmentId,
                    "linkType": payload.linkType
                }
            )
        
        # Create link
        link = SegmentLink(
            from_segment_id=from_segment_id,
            to_segment_id=payload.toSegmentId,
            link_type=payload.linkType,
            notes=payload.notes,
            created_by_user_id=user.id
        )
        session.add(link)
        session.commit()
        session.refresh(link)
        
        return {
            "id": link.id,
            "fromSegmentId": link.from_segment_id,
            "toSegmentId": link.to_segment_id,
            "linkType": link.link_type,
            "notes": link.notes,
            "createdAt": link.created_at.isoformat(),
            "createdByUserId": link.created_by_user_id,
        }


@router.get("/segments/{segment_id}/links")
def get_segment_links(
    segment_id: int,
    direction: str = Query(default="both", description="Links direction: 'from', 'to', or 'both'"),
    user: User = Depends(get_current_user),
):
    """Get all links for a segment (incoming, outgoing, or both)"""
    with Session(engine) as session:
        # Validate segment exists and belongs to user
        seg = session.exec(
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == segment_id, Document.user_id == user.id)
        ).first()
        if not seg:
            raise not_found("Segment", str(segment_id))
        
        links = []
        
        if direction in ("from", "both"):
            from_links = session.exec(
                select(SegmentLink).where(SegmentLink.from_segment_id == segment_id)
            ).all()
            for link in from_links:
                links.append({
                    "id": link.id,
                    "fromSegmentId": link.from_segment_id,
                    "toSegmentId": link.to_segment_id,
                    "linkType": link.link_type,
                    "notes": link.notes,
                    "direction": "from",
                    "createdAt": link.created_at.isoformat(),
                    "createdByUserId": link.created_by_user_id,
                })
        
        if direction in ("to", "both"):
            to_links = session.exec(
                select(SegmentLink).where(SegmentLink.to_segment_id == segment_id)
            ).all()
            for link in to_links:
                links.append({
                    "id": link.id,
                    "fromSegmentId": link.from_segment_id,
                    "toSegmentId": link.to_segment_id,
                    "linkType": link.link_type,
                    "notes": link.notes,
                    "direction": "to",
                    "createdAt": link.created_at.isoformat(),
                    "createdByUserId": link.created_by_user_id,
                })
        
        return {
            "segmentId": segment_id,
            "direction": direction,
            "links": links,
            "count": len(links),
        }


@router.delete("/segment-links/{link_id}")
def delete_segment_link(
    link_id: int,
    user: User = Depends(get_current_user),
):
    """Delete a segment link"""
    with Session(engine) as session:
        link = session.exec(
            select(SegmentLink)
            .join(Segment, SegmentLink.from_segment_id == Segment.id)
            .join(Document, Segment.document_id == Document.id)
            .where(SegmentLink.id == link_id, Document.user_id == user.id)
        ).first()
        if not link:
            raise not_found("SegmentLink", str(link_id))
        
        session.delete(link)
        session.commit()
        
        return {"ok": True, "deletedId": link_id}
