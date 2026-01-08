"""
Workspace API routes: Folders, Smart Notes, Document Notes
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ai_organizer.core.db import engine
from ai_organizer.core.auth_dep import get_current_user, get_db
from ai_organizer.models import (
    User, Document, Folder, FolderItem, SmartNote, DocumentNote, Segment
)

router = APIRouter()


# ============================================================================
# Folders
# ============================================================================

class FolderOut(BaseModel):
    id: int
    name: str
    documentId: int
    createdAt: str
    itemCount: int = 0

    class Config:
        from_attributes = True


class FolderItemOut(BaseModel):
    id: int
    folderId: int
    segmentId: Optional[int] = None
    chunkId: Optional[str] = None
    chunkTitle: Optional[str] = None
    chunkContent: Optional[str] = None
    chunkMode: Optional[str] = None
    chunkIsManual: Optional[bool] = None
    chunkOrderIndex: Optional[int] = None
    createdAt: str

    class Config:
        from_attributes = True


class FolderWithItemsOut(FolderOut):
    items: list[FolderItemOut] = []


class FolderCreateIn(BaseModel):
    name: str
    documentId: int


class FolderItemCreateIn(BaseModel):
    folderId: int
    segmentId: Optional[int] = None
    chunkId: Optional[str] = None
    chunkTitle: Optional[str] = None
    chunkContent: Optional[str] = None
    chunkMode: Optional[str] = None
    chunkIsManual: Optional[bool] = None
    chunkOrderIndex: Optional[int] = None


@router.get("/documents/{document_id}/folders", response_model=list[FolderOut])
def list_folders(
    document_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """List all folders for a document"""
    # Verify document belongs to user
    doc = session.exec(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    folders = session.exec(
        select(Folder).where(
            Folder.document_id == document_id,
            Folder.user_id == user.id
        )
    ).all()

    result = []
    for folder in folders:
        item_count = session.exec(
            select(FolderItem).where(FolderItem.folder_id == folder.id)
        ).all()
        result.append(FolderOut(
            id=folder.id,
            name=folder.name,
            documentId=folder.document_id,
            createdAt=folder.created_at.isoformat(),
            itemCount=len(item_count),
        ))

    return result


@router.get("/folders/{folder_id}", response_model=FolderWithItemsOut)
def get_folder(
    folder_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get a folder with its items"""
    folder = session.exec(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    items = session.exec(
        select(FolderItem).where(FolderItem.folder_id == folder_id)
    ).all()

    return FolderWithItemsOut(
        id=folder.id,
        name=folder.name,
        documentId=folder.document_id,
        createdAt=folder.created_at.isoformat(),
        itemCount=len(items),
        items=[
            FolderItemOut(
                id=item.id,
                folderId=item.folder_id,
                segmentId=item.segment_id,
                chunkId=item.chunk_id,
                chunkTitle=item.chunk_title,
                chunkContent=item.chunk_content,
                chunkMode=item.chunk_mode,
                chunkIsManual=item.chunk_is_manual,
                chunkOrderIndex=item.chunk_order_index,
                createdAt=item.created_at.isoformat(),
            )
            for item in items
        ],
    )


@router.post("/folders", response_model=FolderOut)
def create_folder(
    payload: FolderCreateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Create a new folder"""
    # Verify document belongs to user
    doc = session.exec(
        select(Document).where(Document.id == payload.documentId, Document.user_id == user.id)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    folder = Folder(
        user_id=user.id,
        document_id=payload.documentId,
        name=payload.name.strip(),
        created_at=datetime.utcnow(),
    )
    session.add(folder)
    session.commit()
    session.refresh(folder)

    return FolderOut(
        id=folder.id,
        name=folder.name,
        documentId=folder.document_id,
        createdAt=folder.created_at.isoformat(),
        itemCount=0,
    )


@router.patch("/folders/{folder_id}", response_model=FolderOut)
def update_folder(
    folder_id: int,
    name: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Rename a folder"""
    folder = session.exec(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    folder.name = name.strip()
    session.add(folder)
    session.commit()
    session.refresh(folder)

    item_count = len(session.exec(
        select(FolderItem).where(FolderItem.folder_id == folder_id)
    ).all())

    return FolderOut(
        id=folder.id,
        name=folder.name,
        documentId=folder.document_id,
        createdAt=folder.created_at.isoformat(),
        itemCount=item_count,
    )


@router.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Delete a folder and all its items"""
    folder = session.exec(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == user.id)
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Delete all items first (cascade should handle this, but explicit is better)
    items = session.exec(
        select(FolderItem).where(FolderItem.folder_id == folder_id)
    ).all()
    for item in items:
        session.delete(item)

    session.delete(folder)
    session.commit()

    return {"ok": True}


@router.post("/folder-items", response_model=FolderItemOut)
def create_folder_item(
    payload: FolderItemCreateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Add an item (segment or chunk) to a folder"""
    # Verify folder belongs to user
    folder = session.exec(
        select(Folder).where(Folder.id == payload.folderId, Folder.user_id == user.id)
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # If segment_id is provided, verify it exists and belongs to user's document
    if payload.segmentId:
        segment = session.exec(
            select(Segment).where(Segment.id == payload.segmentId)
        ).first()
        if not segment:
            raise HTTPException(status_code=404, detail="Segment not found")
        
        doc = session.exec(
            select(Document).where(Document.id == segment.document_id, Document.user_id == user.id)
        ).first()
        if not doc:
            raise HTTPException(status_code=403, detail="Segment does not belong to user")

    # Check if item already exists
    if payload.segmentId:
        existing = session.exec(
            select(FolderItem).where(
                FolderItem.folder_id == payload.folderId,
                FolderItem.segment_id == payload.segmentId
            )
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Item already in folder")
    elif payload.chunkId:
        existing = session.exec(
            select(FolderItem).where(
                FolderItem.folder_id == payload.folderId,
                FolderItem.chunk_id == payload.chunkId
            )
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Item already in folder")

    item = FolderItem(
        folder_id=payload.folderId,
        segment_id=payload.segmentId,
        chunk_id=payload.chunkId,
        chunk_title=payload.chunkTitle,
        chunk_content=payload.chunkContent,
        chunk_mode=payload.chunkMode,
        chunk_is_manual=payload.chunkIsManual,
        chunk_order_index=payload.chunkOrderIndex,
        created_at=datetime.utcnow(),
    )
    session.add(item)
    session.commit()
    session.refresh(item)

    return FolderItemOut(
        id=item.id,
        folderId=item.folder_id,
        segmentId=item.segment_id,
        chunkId=item.chunk_id,
        chunkTitle=item.chunk_title,
        chunkContent=item.chunk_content,
        chunkMode=item.chunk_mode,
        chunkIsManual=item.chunk_is_manual,
        chunkOrderIndex=item.chunk_order_index,
        createdAt=item.created_at.isoformat(),
    )


@router.delete("/folder-items/{item_id}")
def delete_folder_item(
    item_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Remove an item from a folder"""
    item = session.exec(select(FolderItem).where(FolderItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Folder item not found")

    # Verify folder belongs to user
    folder = session.exec(
        select(Folder).where(Folder.id == item.folder_id, Folder.user_id == user.id)
    ).first()
    if not folder:
        raise HTTPException(status_code=403, detail="Folder does not belong to user")

    session.delete(item)
    session.commit()

    return {"ok": True}


# ============================================================================
# Smart Notes
# ============================================================================

class SmartNoteOut(BaseModel):
    id: int
    documentId: int
    content: str
    html: str
    tags: list[str]
    category: str
    priority: str
    chunkId: Optional[int] = None
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True


class SmartNoteCreateIn(BaseModel):
    documentId: int
    content: str
    html: str
    tags: list[str] = []
    category: str = "General"
    priority: str = "medium"
    chunkId: Optional[int] = None


class SmartNoteUpdateIn(BaseModel):
    content: Optional[str] = None
    html: Optional[str] = None
    tags: Optional[list[str]] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    chunkId: Optional[int] = None


@router.get("/documents/{document_id}/smart-notes", response_model=list[SmartNoteOut])
def list_smart_notes(
    document_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """List all smart notes for a document"""
    # Verify document belongs to user
    doc = session.exec(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    notes = session.exec(
        select(SmartNote).where(
            SmartNote.document_id == document_id,
            SmartNote.user_id == user.id
        )
    ).all()

    result = []
    for note in notes:
        try:
            tags = json.loads(note.tags) if note.tags else []
        except:
            tags = []
        
        result.append(SmartNoteOut(
            id=note.id,
            documentId=note.document_id,
            content=note.content,
            html=note.html,
            tags=tags,
            category=note.category,
            priority=note.priority,
            chunkId=note.chunk_id,
            createdAt=note.created_at.isoformat(),
            updatedAt=note.updated_at.isoformat(),
        ))

    return result


@router.post("/smart-notes", response_model=SmartNoteOut)
def create_smart_note(
    payload: SmartNoteCreateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Create a new smart note"""
    # Verify document belongs to user
    doc = session.exec(
        select(Document).where(Document.id == payload.documentId, Document.user_id == user.id)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # If chunk_id is provided, verify it exists
    if payload.chunkId:
        segment = session.exec(
            select(Segment).where(Segment.id == payload.chunkId)
        ).first()
        if not segment or segment.document_id != payload.documentId:
            raise HTTPException(status_code=404, detail="Chunk not found")

    note = SmartNote(
        user_id=user.id,
        document_id=payload.documentId,
        content=payload.content,
        html=payload.html,
        tags=json.dumps(payload.tags),
        category=payload.category,
        priority=payload.priority,
        chunk_id=payload.chunkId,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(note)
    session.commit()
    session.refresh(note)

    try:
        tags = json.loads(note.tags) if note.tags else []
    except:
        tags = []

    return SmartNoteOut(
        id=note.id,
        documentId=note.document_id,
        content=note.content,
        html=note.html,
        tags=tags,
        category=note.category,
        priority=note.priority,
        chunkId=note.chunk_id,
        createdAt=note.created_at.isoformat(),
        updatedAt=note.updated_at.isoformat(),
    )


@router.patch("/smart-notes/{note_id}", response_model=SmartNoteOut)
def update_smart_note(
    note_id: int,
    payload: SmartNoteUpdateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Update a smart note"""
    note = session.exec(
        select(SmartNote).where(SmartNote.id == note_id, SmartNote.user_id == user.id)
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Smart note not found")

    if payload.content is not None:
        note.content = payload.content
    if payload.html is not None:
        note.html = payload.html
    if payload.tags is not None:
        note.tags = json.dumps(payload.tags)
    if payload.category is not None:
        note.category = payload.category
    if payload.priority is not None:
        note.priority = payload.priority
    if payload.chunkId is not None:
        if payload.chunkId:
            segment = session.exec(
                select(Segment).where(Segment.id == payload.chunkId)
            ).first()
            if not segment or segment.document_id != note.document_id:
                raise HTTPException(status_code=404, detail="Chunk not found")
        note.chunk_id = payload.chunkId

    note.updated_at = datetime.utcnow()
    session.add(note)
    session.commit()
    session.refresh(note)

    try:
        tags = json.loads(note.tags) if note.tags else []
    except:
        tags = []

    return SmartNoteOut(
        id=note.id,
        documentId=note.document_id,
        content=note.content,
        html=note.html,
        tags=tags,
        category=note.category,
        priority=note.priority,
        chunkId=note.chunk_id,
        createdAt=note.created_at.isoformat(),
        updatedAt=note.updated_at.isoformat(),
    )


@router.delete("/smart-notes/{note_id}")
def delete_smart_note(
    note_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Delete a smart note"""
    note = session.exec(
        select(SmartNote).where(SmartNote.id == note_id, SmartNote.user_id == user.id)
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Smart note not found")

    session.delete(note)
    session.commit()

    return {"ok": True}


# ============================================================================
# Document Notes
# ============================================================================

class DocumentNoteOut(BaseModel):
    id: int
    documentId: int
    html: str
    text: str
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True


class DocumentNoteUpdateIn(BaseModel):
    html: str
    text: str


@router.get("/documents/{document_id}/note", response_model=Optional[DocumentNoteOut])
def get_document_note(
    document_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get document note for a document"""
    # Verify document belongs to user
    doc = session.exec(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    note = session.exec(
        select(DocumentNote).where(
            DocumentNote.document_id == document_id,
            DocumentNote.user_id == user.id
        )
    ).first()

    if not note:
        return None

    return DocumentNoteOut(
        id=note.id,
        documentId=note.document_id,
        html=note.html,
        text=note.text,
        createdAt=note.created_at.isoformat(),
        updatedAt=note.updated_at.isoformat(),
    )


@router.put("/documents/{document_id}/note", response_model=DocumentNoteOut)
def upsert_document_note(
    document_id: int,
    payload: DocumentNoteUpdateIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Create or update document note"""
    # Verify document belongs to user
    doc = session.exec(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    note = session.exec(
        select(DocumentNote).where(
            DocumentNote.document_id == document_id,
            DocumentNote.user_id == user.id
        )
    ).first()

    if note:
        # Update existing
        note.html = payload.html
        note.text = payload.text
        note.updated_at = datetime.utcnow()
    else:
        # Create new
        note = DocumentNote(
            user_id=user.id,
            document_id=document_id,
            html=payload.html,
            text=payload.text,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(note)

    session.commit()
    session.refresh(note)

    return DocumentNoteOut(
        id=note.id,
        documentId=note.document_id,
        html=note.html,
        text=note.text,
        createdAt=note.created_at.isoformat(),
        updatedAt=note.updated_at.isoformat(),
    )


@router.delete("/documents/{document_id}/note")
def delete_document_note(
    document_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Delete document note"""
    note = session.exec(
        select(DocumentNote).where(
            DocumentNote.document_id == document_id,
            DocumentNote.user_id == user.id
        )
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Document note not found")

    session.delete(note)
    session.commit()

    return {"ok": True}


# ============================================================================
# Migration endpoint (import localStorage data)
# ============================================================================

class MigrationDataIn(BaseModel):
    documentId: int
    folders: Optional[list[dict]] = None
    folderMap: Optional[dict[str, str]] = None  # segment_id -> folder_id
    duplicatedChunks: Optional[list[dict]] = None
    smartNotes: Optional[list[dict]] = None
    documentNote: Optional[dict] = None


@router.post("/documents/{document_id}/migrate-localstorage")
def migrate_localstorage_data(
    document_id: int,
    payload: MigrationDataIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Migrate localStorage data to database.
    This endpoint imports folders, chunks, notes from localStorage format.
    """
    # Verify document belongs to user
    doc = session.exec(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    imported = {
        "folders": 0,
        "folderItems": 0,
        "smartNotes": 0,
        "documentNote": False,
    }

    # Import folders
    if payload.folders:
        folder_id_map = {}  # old_id (string) -> new_id (int)
        
        for folder_data in payload.folders:
            old_id = folder_data.get("id")
            name = folder_data.get("name", "").strip()
            if not name:
                continue

            # Check if folder with same name already exists
            existing = session.exec(
                select(Folder).where(
                    Folder.document_id == document_id,
                    Folder.user_id == user.id,
                    Folder.name == name
                )
            ).first()
            
            if existing:
                folder_id_map[old_id] = existing.id
                continue

            folder = Folder(
                user_id=user.id,
                document_id=document_id,
                name=name,
                created_at=datetime.fromtimestamp(folder_data.get("createdAt", datetime.utcnow().timestamp()) / 1000) if isinstance(folder_data.get("createdAt"), (int, float)) else datetime.utcnow(),
            )
            session.add(folder)
            session.flush()  # Get the ID
            folder_id_map[old_id] = folder.id
            imported["folders"] += 1

        session.commit()

        # Import folder items (from folder.contents and folderMap)
        if payload.folderMap and payload.duplicatedChunks:
            chunks_by_id = {chunk.get("id"): chunk for chunk in (payload.duplicatedChunks or [])}
            
            for old_folder_id, new_folder_id in folder_id_map.items():
                # Get items from folder.contents
                folder_data = next((f for f in payload.folders if f.get("id") == old_folder_id), None)
                if folder_data:
                    contents = folder_data.get("contents", [])
                    for chunk_id in contents:
                        chunk = chunks_by_id.get(chunk_id)
                        if chunk:
                            item = FolderItem(
                                folder_id=new_folder_id,
                                chunk_id=chunk_id,
                                chunk_title=chunk.get("title"),
                                chunk_content=chunk.get("content"),
                                chunk_mode=chunk.get("mode"),
                                chunk_is_manual=chunk.get("isManual", False),
                                chunk_order_index=chunk.get("orderIndex", 0),
                                created_at=datetime.fromtimestamp(chunk.get("createdAt", datetime.utcnow().timestamp()) / 1000) if isinstance(chunk.get("createdAt"), (int, float)) else datetime.utcnow(),
                            )
                            session.add(item)
                            imported["folderItems"] += 1

            # Import from folderMap (segment_id -> folder_id)
            for segment_id_str, old_folder_id in payload.folderMap.items():
                try:
                    segment_id = int(segment_id_str)
                    new_folder_id = folder_id_map.get(old_folder_id)
                    if new_folder_id:
                        # Verify segment exists
                        segment = session.exec(
                            select(Segment).where(Segment.id == segment_id)
                        ).first()
                        if segment and segment.document_id == document_id:
                            # Check if already exists
                            existing = session.exec(
                                select(FolderItem).where(
                                    FolderItem.folder_id == new_folder_id,
                                    FolderItem.segment_id == segment_id
                                )
                            ).first()
                            if not existing:
                                item = FolderItem(
                                    folder_id=new_folder_id,
                                    segment_id=segment_id,
                                    created_at=datetime.utcnow(),
                                )
                                session.add(item)
                                imported["folderItems"] += 1
                except ValueError:
                    continue

        session.commit()

    # Import smart notes
    if payload.smartNotes:
        for note_data in payload.smartNotes:
            try:
                tags = note_data.get("tags", [])
                if isinstance(tags, str):
                    tags = json.loads(tags)
                
                note = SmartNote(
                    user_id=user.id,
                    document_id=document_id,
                    content=note_data.get("content", ""),
                    html=note_data.get("html", ""),
                    tags=json.dumps(tags),
                    category=note_data.get("category", "General"),
                    priority=note_data.get("priority", "medium"),
                    chunk_id=note_data.get("chunkId"),
                    created_at=datetime.fromisoformat(note_data.get("timestamp", datetime.utcnow().isoformat()).replace("Z", "+00:00")) if isinstance(note_data.get("timestamp"), str) else datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                session.add(note)
                imported["smartNotes"] += 1
            except Exception as e:
                # Skip invalid notes
                continue

        session.commit()

    # Import document note
    if payload.documentNote:
        note_data = payload.documentNote
        existing = session.exec(
            select(DocumentNote).where(
                DocumentNote.document_id == document_id,
                DocumentNote.user_id == user.id
            )
        ).first()

        if existing:
            existing.html = note_data.get("html", "")
            existing.text = note_data.get("text", "")
            existing.updated_at = datetime.utcnow()
        else:
            note = DocumentNote(
                user_id=user.id,
                document_id=document_id,
                html=note_data.get("html", ""),
                text=note_data.get("text", ""),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(note)
        
        imported["documentNote"] = True
        session.commit()

    return {
        "ok": True,
        "imported": imported,
        "message": f"Migrated {imported['folders']} folders, {imported['folderItems']} items, {imported['smartNotes']} smart notes, document note: {imported['documentNote']}"
    }
