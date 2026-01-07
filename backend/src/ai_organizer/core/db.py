# C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\backend\src\ai_organizer\core\db.py
from __future__ import annotations

from pathlib import Path
from typing import Generator

from sqlmodel import SQLModel, Session, create_engine

from ai_organizer.core.config import settings


def _get_data_dir() -> Path:
    """
    Prefer AIORG_DATA_DIR from settings (always absolute path).
    This ensures consistency regardless of working directory.
    """
    v = getattr(settings, "AIORG_DATA_DIR", None)
    if v:
        return Path(str(v)).resolve()
    
    # Fallback: use same logic as config.py for consistency
    from ai_organizer.core.config import BACKEND_DIR
    return (BACKEND_DIR / "data").resolve()


DATA_DIR = _get_data_dir()
UPLOADS_DIR = DATA_DIR / "uploads"
PROCESSED_DIR = DATA_DIR / "processed"


def ensure_data_dirs() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def _get_db_url() -> str:
    """
    Single source of truth: Always use settings.AIORG_DB_URL (which is always absolute).
    This ensures the same database file is used regardless of working directory.
    """
    # Always use settings.AIORG_DB_URL which is set in config.py with absolute path
    url = getattr(settings, "AIORG_DB_URL", None)
    if url:
        return str(url)
    
    # Fallback: construct from DATA_DIR (should never happen if config.py is correct)
    data_dir = _get_data_dir()
    db_file = (data_dir / "app.db").resolve()
    return f"sqlite:///{db_file.as_posix()}"


DB_URL = _get_db_url()

# Ensure database directory exists before creating engine
if DB_URL.startswith("sqlite"):
    db_path_str = DB_URL.replace("sqlite:///", "")
    db_path = Path(db_path_str)
    db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    DB_URL,
    connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {},
    # Enable connection pooling and ensure database file is created
    pool_pre_ping=True,
)


def create_db_and_tables() -> None:
    """
    Creates database tables if they don't exist.
    This ensures persistence across server restarts.
    Uses create_all which is idempotent - won't recreate existing tables.
    """
    # Ensure the database directory exists
    if DB_URL.startswith("sqlite"):
        # Extract path from sqlite:///path/to/db
        db_path_str = DB_URL.replace("sqlite:///", "")
        db_path = Path(db_path_str)
        db_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Import models to ensure metadata is populated
    import ai_organizer.models  # noqa: F401
    
    # Create all tables (idempotent - won't recreate if they exist)
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
