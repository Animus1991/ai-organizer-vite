# backend/src/ai_organizer/models.py

from datetime import datetime
from typing import Optional
from enum import Enum

from sqlalchemy import UniqueConstraint, CheckConstraint
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import String, Integer, Text


# ============================================================================
# P2: Research-Grade Enums (defined before models that use them)
# ============================================================================

# P2: Research-Grade Segment Types
class SegmentType(str, Enum):
    """Scientific segment typing for research-grade organization"""
    # Core types
    DEFINITION = "definition"
    ASSUMPTION = "assumption"
    CLAIM = "claim"
    MECHANISM = "mechanism"  # Causal chain
    PREDICTION = "prediction"  # Testable prediction
    COUNTERARGUMENT = "counterargument"
    EVIDENCE = "evidence"
    OPEN_QUESTION = "open_question"
    EXPERIMENT = "experiment"  # Test/experiment description
    META = "meta"  # Structure/outline/paper structure
    # Fallback
    UNTYPED = "untyped"  # Default for existing segments


# P2: Evidence Grading Scale
class EvidenceGrade(str, Enum):
    """Evidence quality grading (E0-E4) for claims and predictions"""
    E0 = "E0"  # No evidence (idea/hypothesis)
    E1 = "E1"  # Internal logic only
    E2 = "E2"  # General literature reference (no excerpt)
    E3 = "E3"  # Precise source excerpt (page/quote)
    E4 = "E4"  # Reproducible data/experiment


# P2: Segment Linking Graph
class LinkType(str, Enum):
    """Types of relationships between segments"""
    SUPPORTS = "supports"  # Segment A supports/evidences Segment B (claim)
    CONTRADICTS = "contradicts"  # Segment A contradicts Segment B
    DEPENDS_ON = "depends_on"  # Segment A depends on Segment B (definition → claim)
    COUNTERARGUMENT = "counterargument"  # Segment A is counterargument to Segment B
    EVIDENCE = "evidence"  # Segment A is evidence for Segment B (claim)
    RELATED = "related"  # General relationship (weak link)


# ============================================================================
# Core Models
# ============================================================================

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


class DocumentVersion(SQLModel, table=True):
    """
    Document versioning system for provenance safety.
    
    When a document is edited, instead of mutating the original Document.text,
    a new DocumentVersion row is created. The original Document.text remains immutable.
    
    Architecture Invariant: Original text is immutable; edits create derived versions.
    """
    __tablename__ = "document_versions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    document_id: int = Field(foreign_key="documents.id", index=True)
    version_number: int = Field(index=True)
    
    title: str
    text: str
    
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    created_by_user_id: int = Field(foreign_key="users.id", index=True)
    
    document: Optional["Document"] = Relationship(back_populates="versions")
    created_by_user: Optional["User"] = Relationship()
    
    __table_args__ = (
        UniqueConstraint("document_id", "version_number", name="uq_document_version"),
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

    upload: Optional["Upload"] = Relationship(back_populates="documents")

    parse_status: str = Field(default="pending", index=True)
    parse_error: Optional[str] = Field(default=None)
    processed_path: Optional[str] = Field(default=None)
    
    # P3: Soft delete field
    deleted_at: Optional[datetime] = Field(default=None, index=True)

    user: Optional["User"] = Relationship(back_populates="documents")

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
    versions: list["DocumentVersion"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "order_by": "DocumentVersion.version_number"},
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

    # P2: Research-Grade Fields
    segment_type: Optional[str] = Field(
        default=SegmentType.UNTYPED.value,
        index=True,
        description="Scientific segment type (definition, claim, prediction, etc.)"
    )
    evidence_grade: Optional[str] = Field(
        default=None,
        index=True,
        description="Evidence quality grade (E0-E4) for claims/predictions"
    )
    falsifiability_criteria: Optional[str] = Field(
        default=None,
        description="What would falsify this claim/prediction? What observation weakens it?"
    )

    # P3: Soft delete field
    deleted_at: Optional[datetime] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    document: Optional["Document"] = Relationship(back_populates="segments")
    
    # P2: Linking relationships (defined after SegmentLink model)
    links_from: list["SegmentLink"] = Relationship(
        back_populates="from_segment",
        sa_relationship_kwargs={"foreign_keys": "[SegmentLink.from_segment_id]", "cascade": "all, delete-orphan"}
    )
    links_to: list["SegmentLink"] = Relationship(
        back_populates="to_segment",
        sa_relationship_kwargs={"foreign_keys": "[SegmentLink.to_segment_id]", "cascade": "all, delete-orphan"}
    )


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
# P2: Research-Grade Models
# ============================================================================

class SegmentLink(SQLModel, table=True):
    """
    P2: Linking graph for research-grade reasoning chains.
    
    Supports traceable relations between segments:
    - Claim ↔ Evidence
    - Claim ↔ Counterargument
    - Claim ↔ Definition (depends on)
    - Claim ↔ Prediction/Test
    - Segment ↔ Segment (supports/contradicts/depends-on)
    """
    __tablename__ = "segment_links"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    from_segment_id: int = Field(foreign_key="segments.id", index=True)
    to_segment_id: int = Field(foreign_key="segments.id", index=True)
    
    link_type: str = Field(
        default=LinkType.RELATED.value,
        index=True,
        description="Type of relationship (supports, contradicts, depends_on, etc.)"
    )
    
    # Optional: User notes about the link
    notes: Optional[str] = Field(default=None, description="User notes about this link")
    
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    created_by_user_id: int = Field(foreign_key="users.id", index=True)
    
    from_segment: Optional["Segment"] = Relationship(
        back_populates="links_from",
        sa_relationship_kwargs={"foreign_keys": "[SegmentLink.from_segment_id]"}
    )
    to_segment: Optional["Segment"] = Relationship(
        back_populates="links_to",
        sa_relationship_kwargs={"foreign_keys": "[SegmentLink.to_segment_id]"}
    )
    created_by_user: Optional["User"] = Relationship()
    
    __table_args__ = (
        UniqueConstraint("from_segment_id", "to_segment_id", "link_type", name="uq_segment_link"),
        # Prevent self-links (segment cannot link to itself)
        CheckConstraint("from_segment_id != to_segment_id", name="ck_no_self_link"),
    )


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
    
    # P3: Soft delete field
    deleted_at: Optional[datetime] = Field(default=None, index=True)

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