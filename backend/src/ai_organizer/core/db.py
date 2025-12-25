from __future__ import annotations
from sqlmodel import SQLModel, Session, create_engine
from ai_organizer.core.config import settings

engine = create_engine(
    settings.AIORG_DB_URL,
    connect_args={"check_same_thread": False} if settings.AIORG_DB_URL.startswith("sqlite") else {},
)

def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
