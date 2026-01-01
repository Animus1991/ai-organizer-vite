# C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\backend\src\ai_organizer\core\db.py
from __future__ import annotations

from pathlib import Path
from typing import Generator

from sqlmodel import SQLModel, Session, create_engine

from ai_organizer.core.config import settings


def _get_data_dir() -> Path:
    """
    Prefer AIORG_DATA_DIR if υπάρχει (π.χ. από .env),
    αλλιώς fallback σε ./data (portable, relative στο backend cwd).
    """
    v = getattr(settings, "AIORG_DATA_DIR", None)
    if v:
        return Path(str(v))

    return Path("./data").resolve()


DATA_DIR = _get_data_dir()
UPLOADS_DIR = DATA_DIR / "uploads"
PROCESSED_DIR = DATA_DIR / "processed"


def ensure_data_dirs() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def _get_db_url() -> str:
    """
    Single source of truth:
      - AIORG_DB_URL (preferred)
      - DATABASE_URL (fallback)
      - sqlite:///./data/app.db (safe fallback)
    """
    url = getattr(settings, "AIORG_DB_URL", None) or getattr(settings, "DATABASE_URL", None)
    if not url:
        url = "sqlite:///./data/app.db"
    return str(url)


DB_URL = _get_db_url()

engine = create_engine(
    DB_URL,
    connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {},
)


def create_db_and_tables() -> None:
    """
    ΠΡΟΣΟΧΗ: Μην το τρέχεις αυτόματα στο startup.
    Το κρατάμε μόνο για optional dev-flag (AIORG_DEV_CREATE_ALL=1).
    """
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
