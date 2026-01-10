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
    DEPRECATED: Creates database tables if they don't exist.
    
    ⚠️ WARNING: This function violates the architecture invariant that Alembic
    migrations are the only source of truth for schema changes.
    
    This function is kept for backward compatibility and potential test scenarios,
    but should NOT be called in production code. Use `alembic upgrade head` instead.
    
    Uses create_all which is idempotent - won't recreate existing tables.
    However, this can cause schema drift if migrations are not applied correctly.
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
    # ⚠️ This can conflict with Alembic migrations if schema drifts
    SQLModel.metadata.create_all(engine)


def verify_database_connection() -> None:
    """
    Verifies database connection without creating tables.
    
    This function checks if:
    1. Database directory exists (for SQLite) - creates if needed
    2. Connection to database is possible (even if database file doesn't exist yet)
    3. Basic queries can be executed (if database exists)
    
    Architecture Invariant: It does NOT create tables - that must be done via Alembic migrations.
    If database file doesn't exist, this will still succeed (SQLite creates file on first write).
    If tables don't exist, this will still succeed (schema check happens separately in startup).
    
    Raises:
        RuntimeError: If connection to database is impossible (e.g., invalid URL, permissions)
    """
    import logging
    from sqlalchemy import text
    
    logger = logging.getLogger(__name__)
    
    # Ensure database directory exists (for SQLite)
    if DB_URL.startswith("sqlite"):
        db_path_str = DB_URL.replace("sqlite:///", "")
        db_path = Path(db_path_str)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Database path: {db_path}")
        logger.debug(f"Database file exists: {db_path.exists()}")
    
    # Test connection without creating tables
    # Note: SQLite will create the file on first write, so missing file is OK
    try:
        with engine.connect() as conn:
            # Simple query to verify connection works
            # This will succeed even if tables don't exist
            conn.execute(text("SELECT 1"))
            logger.debug("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise RuntimeError(
            f"Database connection failed. Please check database URL and permissions. "
            f"Error: {e}"
        ) from e


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
