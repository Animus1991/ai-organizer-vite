# backend/src/ai_organizer/api/routes/documents.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func

from ai_organizer.api.errors import not_found, create_error_response
from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user
from ai_organizer.models import Document, DocumentVersion, Upload, User
from sqlalchemy import inspect
from sqlalchemy.exc import OperationalError
from datetime import datetime

router = APIRouter()


# P3: Helper function to check if deleted_at column exists
def _has_p3_soft_delete_fields() -> bool:
    """Check if P3 soft delete columns (deleted_at) exist in tables"""
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        
        if "documents" not in tables:
            return False
        
        # Check if deleted_at column exists in documents table
        doc_cols = [c["name"] for c in inspector.get_columns("documents")]
        return "deleted_at" in doc_cols
    except Exception:
        # If inspection fails, assume fields don't exist (safe fallback)
        return False


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


def _get_document_text_version(
    session: Session, doc: Document, version_number: int | None = None
) -> tuple[str, str]:
    """
    Get document text and title for a specific version.
    
    Args:
        session: Database session
        doc: Document object
        version_number: Version number to get (None = latest version, 0 = original)
    
    Returns:
        Tuple of (title, text)
    
    Note: If document_versions table doesn't exist (migration not run), returns original document text.
    This ensures backward compatibility until migration is applied.
    """
    # Check if document_versions table exists (for backward compatibility)
    # If table doesn't exist, return original document text
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        has_versioning_table = "document_versions" in tables
    except Exception:
        # If inspection fails, assume table doesn't exist and return original
        has_versioning_table = False
    
    if not has_versioning_table:
        # Table doesn't exist - return original document text (backward compatibility)
        return doc.title, doc.text or ""
    
    # Table exists - proceed with version lookup (wrap all queries in try/except for safety)
    if version_number == 0:
        # Version 0 = original document text (never edited)
        return doc.title, doc.text or ""
    
    if version_number is None:
        # Get latest version (highest version_number)
        try:
            latest_version = session.exec(
                select(DocumentVersion)
                .where(DocumentVersion.document_id == doc.id)
                .order_by(DocumentVersion.version_number.desc())
                .limit(1)
            ).first()
            
            if latest_version:
                return latest_version.title, latest_version.text
        except OperationalError:
            # Table might not be fully initialized or query failed - return original
            return doc.title, doc.text or ""
        except Exception:
            # Any other error (e.g., table schema mismatch) - return original
            return doc.title, doc.text or ""
        
        # No versions exist, return original document text
        return doc.title, doc.text or ""
    
    # Get specific version
    try:
        version = session.exec(
            select(DocumentVersion).where(
                DocumentVersion.document_id == doc.id,
                DocumentVersion.version_number == version_number
            )
        ).first()
    except OperationalError:
        # Table might not be fully initialized or query failed - return original
        return doc.title, doc.text or ""
    except Exception:
        # Any other error (e.g., table schema mismatch) - return original
        return doc.title, doc.text or ""
    
    if not version:
        raise not_found("Document version", f"{version_number} for document {doc.id}")
    
    return version.title, version.text


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: int,
    version: int | None = Query(default=None, description="Version number (0=original, None=latest)"),
    user: User = Depends(get_current_user),
):
    """
    Get document by ID.
    
    Architecture Invariant: Original Document.text is immutable.
    If versions exist, returns latest version (or specific version if ?version=X).
    Version 0 always returns original Document.text.
    """
    with Session(engine) as session:
        # Build query with P3 soft delete filtering (graceful fallback if column doesn't exist)
        try:
            query = select(Document).where(Document.id == document_id, Document.user_id == user.id)
            if _has_p3_soft_delete_fields():
                query = query.where(Document.deleted_at.is_(None))
            
            doc = session.exec(query).first()
        except (OperationalError, AttributeError) as e:
            # If deleted_at column doesn't exist, retry without filtering
            # This can happen if migration hasn't been run yet
            import logging
            logging.warning(f"P3 soft delete column not found. Retrying without filtering. Error: {e}")
            query = select(Document).where(Document.id == document_id, Document.user_id == user.id)
            doc = session.exec(query).first()

        if not doc:
            raise not_found("Document", str(document_id))

        # Get text and title from version (or original if no versions)
        title, text = _get_document_text_version(session, doc, version)

        up = session.exec(
            select(Upload).where(Upload.id == doc.upload_id, Upload.user_id == user.id)
        ).first()

        filename = up.filename if up else doc.title

        return DocumentOut(
            id=doc.id,
            title=title,
            filename=filename,
            sourceType=doc.source_type,
            text=text,
            parseStatus=doc.parse_status,
            parseError=doc.parse_error,
            processedPath=doc.processed_path,
            upload={
                "id": up.id if up else None,
                "contentType": up.content_type if up else None,  # ✅ camelCase for consistency
                "sizeBytes": up.size_bytes if up else None,  # ✅ camelCase for consistency
                "storedPath": up.stored_path if up else None,  # ✅ camelCase for consistency
            },
        )


@router.patch("/documents/{document_id}", response_model=DocumentOut)
def patch_document(
    document_id: int,
    payload: DocumentPatchIn,
    user: User = Depends(get_current_user),
):
    """
    Update document by creating a new version.
    
    Architecture Invariant: Original Document.text is immutable.
    Editing creates a DocumentVersion row instead of mutating Document.text.
    
    If only title is changed (text unchanged), we still create a version to maintain provenance.
    """
    with Session(engine) as session:
        # Build query with P3 soft delete filtering (graceful fallback if column doesn't exist)
        try:
            query = select(Document).where(Document.id == document_id, Document.user_id == user.id)
            if _has_p3_soft_delete_fields():
                query = query.where(Document.deleted_at.is_(None))
            
            doc = session.exec(query).first()
        except (OperationalError, AttributeError) as e:
            # If deleted_at column doesn't exist, retry without filtering
            # This can happen if migration hasn't been run yet
            import logging
            logging.warning(f"P3 soft delete column not found. Retrying without filtering. Error: {e}")
            query = select(Document).where(Document.id == document_id, Document.user_id == user.id)
            doc = session.exec(query).first()

        if not doc:
            raise not_found("Document", str(document_id))

        # Get current version (latest or original)
        current_title, current_text = _get_document_text_version(session, doc, None)
        
        # Determine new title and text
        new_title = payload.title if payload.title is not None else current_title
        new_text = payload.text if payload.text is not None else current_text
        
        # Check if document_versions table exists (for backward compatibility)
        # If table doesn't exist, fall back to in-place mutation (temporary until migration runs)
        try:
            inspector = inspect(engine)
            tables = set(inspector.get_table_names())
            has_versioning = "document_versions" in tables
        except Exception:
            # If inspection fails, assume table doesn't exist
            has_versioning = False
        
        if has_versioning:
            # Versioning table exists - use versioning system
            # Check if anything actually changed
            version_created = False
            if new_title == current_title and new_text == current_text:
                # No changes - return current state without creating version
                # (This prevents creating redundant versions on no-op edits)
                pass
            else:
                # Create new version
                try:
                    # Get next version number (max version_number + 1, or 1 if no versions exist)
                    max_version = session.exec(
                        select(func.max(DocumentVersion.version_number))
                        .where(DocumentVersion.document_id == doc.id)
                    ).one()
                    
                    next_version_number = (max_version + 1) if max_version is not None else 1
                    
                    new_version = DocumentVersion(
                        document_id=doc.id,
                        version_number=next_version_number,
                        title=new_title,
                        text=new_text,
                        created_by_user_id=user.id,
                    )
                    session.add(new_version)
                    version_created = True
                except OperationalError:
                    # Table exists but query failed (might not be fully initialized) - fall back to in-place mutation
                    has_versioning = False
                except Exception:
                    # Any other error (e.g., table schema mismatch) - fall back to in-place mutation
                    has_versioning = False
        
        if not has_versioning:
            # Versioning table doesn't exist - fall back to in-place mutation (backward compatibility)
            # Note: This is temporary until migration is run. After migration, this path will not be used.
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
        
        # Get latest version (which we just created, or existing latest, or original if no versioning)
        latest_title, latest_text = _get_document_text_version(session, doc, None)
        
        # Update Document.title to match latest version title (for display purposes)
        # This ensures consistency between Document.title and the latest version title
        # Only if versioning is enabled (has_versioning is True)
        if has_versioning and doc.title != latest_title:
            doc.title = latest_title
            session.add(doc)
            session.commit()
            session.refresh(doc)
        else:
            # If no versioning, use current doc.title and doc.text
            latest_title = doc.title
            latest_text = doc.text or ""

        return DocumentOut(
            id=doc.id,
            title=latest_title,
            filename=filename,
            sourceType=doc.source_type,
            text=latest_text,
            parseStatus=doc.parse_status,
            parseError=doc.parse_error,
            processedPath=doc.processed_path,
            upload={
                "id": up.id if up else None,
                "contentType": up.content_type if up else None,  # ✅ camelCase for consistency
                "sizeBytes": up.size_bytes if up else None,  # ✅ camelCase for consistency
                "storedPath": up.stored_path if up else None,  # ✅ camelCase for consistency
            },
        )
