# backend/src/ai_organizer/models.py

from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)

    email: str = Field(index=True, sa_column_kwargs={"unique": True})
    password_hash: str

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    uploads: list["Upload"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    documents: list["Document"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    refresh_tokens: list["RefreshToken"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    folders: list["Folder"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    smart_notes: list["SmartNote"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    document_notes: list["DocumentNote"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Upload(SQLModel, table=True):
    __tablename__ = "uploads"

    id: Optional[int] = Field(default=None, primary_key=True)

    filename: str
    content_type: str
    size_bytes: int
    stored_path: str

    user_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    user: Optional["User"] = Relationship(back_populates="uploads")

    documents: list["Document"] = Relationship(
        back_populates="upload",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: Optional[int] = Field(default=None, primary_key=True)

    upload_id: int = Field(foreign_key="uploads.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    title: str
    source_type: str
    text: str

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    user: Optional["User"] = Relationship(back_populates="documents")
    upload: Optional["Upload"] = Relationship(back_populates="documents")

    parse_status: str = Field(default="pending", index=True)
    parse_error: Optional[str] = Field(default=None)
    processed_path: Optional[str] = Field(default=None)

    segments: list["Segment"] = Relationship(
        back_populates="document",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "Segment.order_index",
        },
    )
    folders: list["Folder"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    smart_notes: list["SmartNote"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    document_note: Optional["DocumentNote"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )


class Segment(SQLModel, table=True):
    __tablename__ = "segments"

    # ✅ σωστό: uniqueness ανά mode (για να μη συγκρούεται auto με manual)
    __table_args__ = (
        UniqueConstraint("document_id", "mode", "order_index", name="uq_segment_doc_mode_order"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)

    document_id: int = Field(foreign_key="documents.id", index=True)
    order_index: int = Field(index=True)

    mode: str  # "qa" | "paragraphs"
    title: str = Field(default="", nullable=False)
    content: str

    start_char: int = Field(default=0, nullable=False)
    end_char: int = Field(default=0, nullable=False)

    # ✅ ΝΕΟ: manual marker
    is_manual: bool = Field(default=False, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    document: Optional["Document"] = Relationship(back_populates="segments")


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="users.id", index=True)
    jti: str = Field(index=True, sa_column_kwargs={"unique": True})

    expires_at: datetime
    revoked: bool = Field(default=False, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    user: Optional["User"] = Relationship(back_populates="refresh_tokens")


# ============================================================================
# User Workspace Models (Folders, Notes, etc.)
# ============================================================================

class Folder(SQLModel, table=True):
    """User-created folders for organizing segments/chunks within a document"""
    __tablename__ = "folders"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="users.id", index=True)
    document_id: int = Field(foreign_key="documents.id", index=True)

    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    user: Optional["User"] = Relationship()
    document: Optional["Document"] = Relationship()

    items: list["FolderItem"] = Relationship(
        back_populates="folder",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class FolderItem(SQLModel, table=True):
    """Items (segments or duplicated chunks) within a folder"""
    __tablename__ = "folder_items"

    id: Optional[int] = Field(default=None, primary_key=True)

    folder_id: int = Field(foreign_key="folders.id", index=True)
    
    # Either segment_id OR chunk_id is set (not both)
    # segment_id: reference to original Segment
    segment_id: Optional[int] = Field(foreign_key="segments.id", default=None, index=True)
    
    # chunk_id: UUID string for duplicated chunks (stored as string, not FK)
    chunk_id: Optional[str] = Field(default=None, index=True)
    
    # Metadata for duplicated chunks (if chunk_id is set)
    chunk_title: Optional[str] = Field(default=None)
    chunk_content: Optional[str] = Field(default=None)
    chunk_mode: Optional[str] = Field(default=None)
    chunk_is_manual: Optional[bool] = Field(default=None)
    chunk_order_index: Optional[int] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    folder: Optional["Folder"] = Relationship(back_populates="items")
    segment: Optional["Segment"] = Relationship()


class SmartNote(SQLModel, table=True):
    """User-created smart notes with tags and categories"""
    __tablename__ = "smart_notes"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="users.id", index=True)
    document_id: int = Field(foreign_key="documents.id", index=True)
    
    content: str  # Plain text content
    html: str  # HTML formatted content
    
    tags: str = Field(default="[]")  # JSON array of tag strings
    category: str = Field(default="General")
    priority: str = Field(default="medium")  # "low" | "medium" | "high"
    
    # Optional link to specific segment/chunk
    chunk_id: Optional[int] = Field(foreign_key="segments.id", default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    user: Optional["User"] = Relationship()
    document: Optional["Document"] = Relationship()
    chunk: Optional["Segment"] = Relationship()


class DocumentNote(SQLModel, table=True):
    """User notes/annotations for a document (HTML formatted)"""
    __tablename__ = "document_notes"

    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="users.id", index=True)
    document_id: int = Field(foreign_key="documents.id", index=True, unique=True)

    html: str  # HTML formatted notes
    text: str  # Plain text version

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    user: Optional["User"] = Relationship()
    document: Optional["Document"] = Relationship()