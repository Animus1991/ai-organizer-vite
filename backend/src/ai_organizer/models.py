# backend/src/ai_organizer/models.py
# from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)

    # unique email (DB-level)
    email: str = Field(index=True, sa_column_kwargs={"unique": True})
    password_hash: str

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    # Relationships (ORM-level cascades)
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
    source_type: str  # "chatgpt_json" | "text" | "md" | "pdf" | ...
    text: str

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    user: Optional["User"] = Relationship(back_populates="documents")
    upload: Optional["Upload"] = Relationship(back_populates="documents")

    segments: list["Segment"] = Relationship(
        back_populates="document",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "order_by": "Segment.order_index",
        },
    )


class Segment(SQLModel, table=True):
    __tablename__ = "segments"

    # Prevent duplicates: same document_id + same order_index not allowed
    __table_args__ = (
        UniqueConstraint("document_id", "order_index", name="uq_segment_doc_order"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)

    document_id: int = Field(foreign_key="documents.id", index=True)
    order_index: int = Field(index=True)

    mode: str  # "qa" | "date_blocks" | "keywords" | ...
    title: str = Field(default="", nullable=False)
    content: str

    start_char: int = Field(default=0, nullable=False)
    end_char: int = Field(default=0, nullable=False)

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
