# backend/src/ai_organizer/api/routes/recycle_bin.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from ai_organizer.api.errors import not_found, bad_request
from sqlmodel import Session, select
from sqlalchemy import func

from ai_organizer.api.errors import not_found
from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, Upload, User, Segment, Folder
from ai_organizer.services.purge_service import purge_service
from datetime import datetime

router = APIRouter()


# ============================================================================
# Documents Recycle Bin
# ============================================================================

@router.delete("/documents/{document_id}")
def soft_delete_document(
    document_id: int,
    user: User = Depends(get_current_user),
):
    """Soft delete a document (move to recycle bin)"""
    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise not_found("Document", str(document_id))
        
        # Check if already deleted
        if doc.deleted_at:
            return {"ok": True, "message": "Document already deleted", "deletedAt": doc.deleted_at.isoformat()}
        
        # Soft delete
        doc.deleted_at = datetime.utcnow()
        session.commit()
        
        return {"ok": True, "deletedAt": doc.deleted_at.isoformat()}


@router.post("/documents/{document_id}/restore")
def restore_document(
    document_id: int,
    user: User = Depends(get_current_user),
):
    """Restore a soft-deleted document from recycle bin"""
    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise not_found("Document", str(document_id))
        
        # Check if not deleted
        if not doc.deleted_at:
            return {"ok": True, "message": "Document not deleted", "deletedAt": None}
        
        # Restore
        doc.deleted_at = None
        session.commit()
        
        return {"ok": True, "deletedAt": None}


@router.get("/documents/recycle-bin")
def list_deleted_documents(
    user: User = Depends(get_current_user),
):
    """List all soft-deleted documents in recycle bin"""
    with Session(engine) as session:
        docs = session.exec(
            select(Document, Upload)
            .join(Upload, Document.upload_id == Upload.id)
            .where(Document.user_id == user.id, Document.deleted_at.isnot(None))
            .order_by(Document.deleted_at.desc())
        ).all()
        
        return [
            {
                "id": doc.id,
                "title": doc.title,
                "filename": upload.filename,
                "sourceType": doc.source_type,
                "deletedAt": doc.deleted_at.isoformat(),
                "upload": {
                    "id": upload.id,
                    "contentType": upload.content_type,
                    "sizeBytes": upload.size_bytes,
                }
            }
            for doc, upload in docs
        ]


@router.delete("/documents/{document_id}/purge")
def permanently_delete_document(
    document_id: int,
    user: User = Depends(get_current_user),
):
    """Permanently delete a document (hard delete)"""
    with Session(engine) as session:
        doc = session.exec(
            select(Document).where(Document.id == document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise not_found("Document", str(document_id))
        
        # Must be soft-deleted first
        if not doc.deleted_at:
            raise bad_request(
                message="Document must be deleted first",
                details={"document_id": document_id, "operation": "purge"}
            )
        
        # Hard delete (cascade will handle related records)
        session.delete(doc)
        session.commit()
        
        return {"ok": True, "permanentlyDeleted": True}


# ============================================================================
# Segments Recycle Bin
# ============================================================================

# Note: Soft delete for segments is handled by DELETE /segments/{segment_id} in segment.py
# This section is for restore, list, and purge operations only

@router.post("/segments/{segment_id}/restore")
def restore_segment(
    segment_id: int,
    user: User = Depends(get_current_user),
):
    """Restore a soft-deleted segment"""
    with Session(engine) as session:
        seg = session.exec(
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == segment_id, Document.user_id == user.id)
        ).first()
        if not seg:
            raise not_found("Segment", str(segment_id))
        
        # Check if not deleted
        if not seg.deleted_at:
            return {"ok": True, "message": "Segment not deleted", "deletedAt": None}
        
        # Restore
        seg.deleted_at = None
        session.commit()
        
        return {"ok": True, "deletedAt": None}


@router.delete("/segments/{segment_id}/purge")
def permanently_delete_segment(
    segment_id: int,
    user: User = Depends(get_current_user),
):
    """Permanently delete a segment (hard delete)"""
    with Session(engine) as session:
        seg = session.exec(
            select(Segment)
            .join(Document, Segment.document_id == Document.id)
            .where(Segment.id == segment_id, Document.user_id == user.id)
        ).first()
        if not seg:
            raise not_found("Segment", str(segment_id))
        
        # Must be soft-deleted first
        if not seg.deleted_at:
            raise bad_request(
                message="Segment must be deleted first",
                details={"segment_id": segment_id, "operation": "purge"}
            )
        
        # Hard delete
        session.delete(seg)
        session.commit()
        
        return {"ok": True, "permanentlyDeleted": True}


@router.get("/segments/recycle-bin")
def list_deleted_segments(
    user: User = Depends(get_current_user),
):
    """List all soft-deleted segments in recycle bin"""
    with Session(engine) as session:
        segments = session.exec(
            select(Segment, Document)
            .join(Document, Segment.document_id == Document.id)
            .where(Document.user_id == user.id, Segment.deleted_at.isnot(None))
            .order_by(Segment.deleted_at.desc())
        ).all()
        
        return [
            {
                "id": seg.id,
                "title": seg.title,
                "content": seg.content[:200] + "..." if len(seg.content) > 200 else seg.content,
                "mode": seg.mode,
                "documentId": doc.id,
                "documentTitle": doc.title,
                "deletedAt": seg.deleted_at.isoformat(),
                "isManual": seg.is_manual,
            }
            for seg, doc in segments
        ]


# ============================================================================
# Folders Recycle Bin
# ============================================================================

# Note: Soft delete for folders is handled by DELETE /workspace/folders/{folder_id} in workspace.py
# This endpoint is for purge (hard delete) only - should be called after soft delete


@router.post("/folders/{folder_id}/restore")
def restore_folder(
    folder_id: int,
    user: User = Depends(get_current_user),
):
    """Restore a soft-deleted folder"""
    with Session(engine) as session:
        folder = session.exec(
            select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
        ).first()
        if not folder:
            raise not_found("Folder", str(folder_id))
        
        # Check if not deleted
        if not folder.deleted_at:
            return {"ok": True, "message": "Folder not deleted", "deletedAt": None}
        
        # Restore
        folder.deleted_at = None
        session.commit()
        
        return {"ok": True, "deletedAt": None}


@router.delete("/folders/{folder_id}/purge")
def permanently_delete_folder(
    folder_id: int,
    user: User = Depends(get_current_user),
):
    """Permanently delete a folder (hard delete)"""
    with Session(engine) as session:
        folder = session.exec(
            select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
        ).first()
        if not folder:
            raise not_found("Folder", str(folder_id))
        
        # Must be soft-deleted first
        if not folder.deleted_at:
            raise bad_request(
                message="Folder must be deleted first",
                details={"folder_id": folder_id, "operation": "purge"}
            )
        
        # Hard delete (cascade will handle related records)
        session.delete(folder)
        session.commit()
        
        return {"ok": True, "permanentlyDeleted": True}


@router.get("/folders/recycle-bin")
def list_deleted_folders(
    user: User = Depends(get_current_user),
):
    """List all soft-deleted folders in recycle bin"""
    with Session(engine) as session:
        folders = session.exec(
            select(Folder, Document)
            .join(Document, Folder.document_id == Document.id)
            .where(Folder.user_id == user.id, Folder.deleted_at.isnot(None))
            .order_by(Folder.deleted_at.desc())
        ).all()
        
        return [
            {
                "id": folder.id,
                "name": folder.name,
                "documentId": doc.id,
                "documentTitle": doc.title,
                "deletedAt": folder.deleted_at.isoformat(),
            }
            for folder, doc in folders
        ]


# ============================================================================
# Combined Recycle Bin
# ============================================================================

@router.get("/recycle-bin")
def list_all_deleted_items(
    user: User = Depends(get_current_user),
):
    """List all soft-deleted items in recycle bin"""
    with Session(engine) as session:
        # Get deleted documents
        docs = session.exec(
            select(Document, Upload)
            .join(Upload, Document.upload_id == Upload.id)
            .where(Document.user_id == user.id, Document.deleted_at.isnot(None))
            .order_by(Document.deleted_at.desc())
        ).all()
        
        # Get deleted segments
        segments = session.exec(
            select(Segment, Document)
            .join(Document, Segment.document_id == Document.id)
            .where(Document.user_id == user.id, Segment.deleted_at.isnot(None))
            .order_by(Segment.deleted_at.desc())
        ).all()
        
        # Get deleted folders
        folders = session.exec(
            select(Folder, Document)
            .join(Document, Folder.document_id == Document.id)
            .where(Folder.user_id == user.id, Folder.deleted_at.isnot(None))
            .order_by(Folder.deleted_at.desc())
        ).all()
        
        return {
            "documents": [
                {
                    "type": "document",
                    "id": doc.id,
                    "title": doc.title,
                    "filename": upload.filename,
                    "deletedAt": doc.deleted_at.isoformat(),
                }
                for doc, upload in docs
            ],
            "segments": [
                {
                    "type": "segment",
                    "id": seg.id,
                    "title": seg.title,
                    "content": seg.content[:100] + "..." if len(seg.content) > 100 else seg.content,
                    "documentTitle": doc.title,
                    "deletedAt": seg.deleted_at.isoformat(),
                }
                for seg, doc in segments
            ],
            "folders": [
                {
                    "type": "folder",
                    "id": folder.id,
                    "name": folder.name,
                    "documentTitle": doc.title,
                    "deletedAt": folder.deleted_at.isoformat(),
                }
                for folder, doc in folders
            ],
        }


# ============================================================================
# P3: Retention Policy & Purge Management
# ============================================================================

@router.get("/retention/stats")
def get_retention_stats(
    user: User = Depends(get_current_user),
):
    """Get retention policy statistics and expired items count"""
    # Only admin users should see this, but for now all users can see their own stats
    stats = purge_service.get_retention_stats()
    return stats


@router.post("/purge/expired")
def purge_expired_items(
    user: User = Depends(get_current_user),
):
    """Manually purge all expired items (older than retention period)"""
    # Only admin users should be able to do this, but for now all users can purge their own items
    results = purge_service.purge_expired_items()
    return {
        "message": f"Purged {sum(results.values())} expired items",
        "results": results,
    }


@router.post("/purge/custom")
def purge_custom_retention(
    days: int,
    user: User = Depends(get_current_user),
):
    """Manually purge items older than specified days"""
    if days < 1:
        raise bad_request(
            message="Days must be at least 1",
            details={"days": days, "operation": "purge_custom"}
        )
    
    results = purge_service.manual_purge(days)
    return {
        "message": f"Purged {sum(results.values())} items older than {days} days",
        "results": results,
    }


@router.get("/purge/status")
def get_purge_status(
    user: User = Depends(get_current_user),
):
    """Get current purge service status and configuration"""
    return {
        "retention_days": purge_service.retention_days,
        "purge_enabled": purge_service.purge_enabled,
        "purge_interval_hours": purge_service.purge_interval_hours,
        "cutoff_date": purge_service.get_cutoff_date().isoformat(),
    }
