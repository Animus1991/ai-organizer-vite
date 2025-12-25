# backend/src/ai_organizer/models.py
from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # σχέσεις (προαιρετικές αλλά χρήσιμες)
    uploads: List["Upload"] = Relationship(back_populates="user")
    documents: List["Document"] = Relationship(back_populates="user")
    refresh_tokens: List["RefreshToken"] = Relationship(back_populates="user")


class Upload(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    content_type: str
    size_bytes: int
    stored_path: str

    # αν κάποτε βάλεις __tablename__ = "users" στο User, τότε εδώ θα γίνει "users.id"
    user_id: int = Field(foreign_key="user.id", index=True)
    user: Optional["User"] = Relationship(back_populates="uploads")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # FK προς Upload (απαραίτητο για σωστή DB ακεραιότητα)
    upload_id: int = Field(foreign_key="upload.id", index=True)

    title: str
    source_type: str  # "chatgpt_json" | "text" | "md" | "pdf" | ...
    text: str

    # multi-user safe
    user_id: int = Field(foreign_key="user.id", index=True)
    user: Optional["User"] = Relationship(back_populates="documents")

    created_at: datetime = Field(default_factory=datetime.utcnow)

    segments: List["Segment"] = Relationship(back_populates="document")


class Segment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # FK προς Document
    document_id: int = Field(foreign_key="document.id", index=True)
    order_index: int = Field(index=True)
    mode: str  # "qa" | "date_blocks" | "keywords" | ...
    title: str = ""
    content: str
    start_char: int = 0
    end_char: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    document: Optional["Document"] = Relationship(back_populates="segments")


class RefreshToken(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # FK προς User
    user_id: int = Field(foreign_key="user.id", index=True)
    jti: str = Field(index=True, unique=True)  # token id
    expires_at: datetime
    revoked: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="refresh_tokens")
