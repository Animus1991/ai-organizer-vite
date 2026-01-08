from __future__ import annotations

import os
from typing import Iterable, List, Union

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_organizer.core.config import settings
from ai_organizer.core.db import ensure_data_dirs
from ai_organizer.api.router import api_router
from fastapi.responses import FileResponse
from pathlib import Path

def _normalize_origins(value: Union[str, Iterable[str], None]) -> List[str]:
    """
    Accepts:
      - "http://localhost:5173"
      - "http://localhost:5173,http://127.0.0.1:5173"
      - ["http://localhost:5173", "http://127.0.0.1:5173"]
      - None
    Returns a clean list of origins.
    """
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(x).strip() for x in value if str(x).strip()]

    s = str(value).strip()
    if not s:
        return []

    return [p.strip() for p in s.split(",") if p.strip()]


origins = _normalize_origins(os.getenv("CORS_ORIGINS", None))

# ✅ fallback για dev
if not origins:
    origins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175"]

allow_all = len(origins) == 1 and origins[0] == "*"
allow_credentials = False if allow_all else True

app = FastAPI(title="AI Organizer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],  # (Authorization / Content-Type κ.λπ.)
)


@app.on_event("startup")
def on_startup() -> None:
    ensure_data_dirs()
    
    # ✅ Ensure database directory exists and is accessible
    # NOTE: Schema creation is handled by Alembic migrations only (single source of truth)
    # Run `alembic upgrade head` before starting the server
    from ai_organizer.core.db import DB_URL, engine
    from pathlib import Path
    import logging
    
    logger = logging.getLogger(__name__)
    
    if DB_URL.startswith("sqlite"):
        db_path_str = DB_URL.replace("sqlite:///", "")
        db_path = Path(db_path_str).resolve()  # Ensure absolute path
        
        # Ensure parent directory exists
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Log database location for debugging
        logger.info(f"Database path: {db_path}")
        logger.info(f"Database path is absolute: {db_path.is_absolute()}")
        logger.info(f"Database file exists: {db_path.exists()}")
        
        if db_path.exists():
            logger.info(f"Database file size: {db_path.stat().st_size} bytes")
        
        # Verify database file exists (should be created by Alembic migrations)
        if not db_path.exists():
            logger.warning(
                f"Database file not found at {db_path}. "
                "Run 'alembic upgrade head' to create the database schema."
            )
    
    # Verify database connection and log location
    try:
        with engine.connect() as conn:
            # Test query to ensure database is accessible
            from sqlalchemy import text
            conn.execute(text("SELECT 1"))
            
            # Check if users table exists and has data
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM users"))
                user_count = result.scalar()
                logger.info(f"Database connection successful. Users in database: {user_count}")
            except Exception as e:
                logger.warning(f"Could not check users table: {e}")
        
        print(f"✅ Database initialized successfully at: {DB_URL}")
        print(f"   Database file: {Path(DB_URL.replace('sqlite:///', '')).resolve()}")
        print(f"   Database file exists: {Path(DB_URL.replace('sqlite:///', '')).resolve().exists()}")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}", exc_info=True)
        print(f"⚠️  Database initialization warning: {e}")
        # Continue anyway - tables might still be created


# ✅ canonical API prefix
app.include_router(api_router, prefix="/api")

# ✅ Health endpoint is handled by api_router (routes/health.py)
# Removed duplicate endpoint to maintain single source of truth

STATIC_DIR = Path(__file__).resolve().parents[3] / "static"

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    ico = STATIC_DIR / "favicon.ico"
    if ico.exists():
        return FileResponse(ico)
    svg = STATIC_DIR / "favicon.svg"
    return FileResponse(svg)
