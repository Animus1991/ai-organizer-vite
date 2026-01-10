from __future__ import annotations

import os
from typing import Iterable, List, Union

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_organizer.core.config import settings
from ai_organizer.core.db import ensure_data_dirs
from ai_organizer.api.router import api_router
from ai_organizer.api.errors import error_response_handler
from fastapi.responses import FileResponse
from fastapi.exceptions import HTTPException
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
    """
    Application startup event.
    
    Ensures data directories exist and verifies database connection.
    Does NOT create tables - that must be done via Alembic migrations.
    
    Architecture Invariant: Alembic migrations are the only source of truth
    for schema changes. No runtime create_all() calls.
    """
    import logging
    from pathlib import Path
    from sqlalchemy import text
    
    ensure_data_dirs()
    
    from ai_organizer.core.db import DB_URL, engine, verify_database_connection
    
    logger = logging.getLogger(__name__)
    
    # Verify database connection (does NOT create tables)
    # This will fail if connection is impossible, but will NOT fail if tables don't exist
    # (tables check happens below)
    try:
        verify_database_connection()
        logger.info("Database connection verified")
    except RuntimeError as e:
        logger.error(str(e))
        logger.error("Please check database URL and permissions. Run migrations: `alembic upgrade head`")
        # Raise to prevent server from starting with broken database connection
        raise
    
    # Determine database path for logging (SQLite only)
    db_path: Path | None = None
    if DB_URL.startswith("sqlite"):
        db_path_str = DB_URL.replace("sqlite:///", "")
        db_path = Path(db_path_str).resolve()
        logger.info(f"Database path: {db_path}")
        logger.info(f"Database file exists: {db_path.exists()}")
        if db_path.exists():
            logger.info(f"Database file size: {db_path.stat().st_size} bytes")
    
    # Verify critical tables exist (indicates migrations have been run)
    # This is a soft check - app will fail on actual queries if schema is missing
    # We don't raise here to allow server to start, but log warnings
    missing_tables: set[str] = set()
    has_pending_migrations = False
    migration_status_msg = ""
    
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        expected_tables = {"users", "uploads", "documents", "segments", "folders", "folder_items"}
        existing_tables = set(inspector.get_table_names())
        missing_tables = expected_tables - existing_tables
        
        # Check for optional tables (new features that may not be migrated yet)
        optional_tables = {"document_versions"}  # P0-2: Document versioning (optional until migration runs)
        missing_optional = optional_tables - existing_tables
        
        if missing_tables:
            logger.warning(
                f"⚠️  Some expected tables are missing: {missing_tables}. "
                "Please run migrations: `alembic upgrade head`"
            )
            logger.warning(
                "Server will start, but operations may fail if schema is incomplete. "
                "It is recommended to run migrations before starting the server."
            )
        else:
            logger.info("✅ All expected tables exist. Database schema appears to be up-to-date.")
            
            # Check if users table has data (optional, informational)
            try:
                with engine.connect() as conn:
                    result = conn.execute(text("SELECT COUNT(*) FROM users"))
                    user_count = result.scalar()
                    logger.info(f"Users in database: {user_count}")
            except Exception:
                pass  # Table exists but query failed - not critical
        
        # Check for optional tables (new features that may not be migrated yet)
        if missing_optional:
            logger.info(
                f"ℹ️  Optional tables missing (features will use fallback behavior): {missing_optional}. "
                "To enable these features, run migrations: `alembic upgrade head`"
            )
        
        # Check for pending migrations (only if alembic_version table exists)
        if "alembic_version" in existing_tables:
            # Table exists - check current revision
            try:
                with engine.connect() as conn:
                    result = conn.execute(text("SELECT version_num FROM alembic_version"))
                    row = result.first()
                    current_revision = row[0] if row else None
                    
                    if current_revision:
                        # Try to get head revision from Alembic scripts
                        try:
                            from alembic.config import Config
                            from alembic import script
                            from pathlib import Path
                            # main.py is at: backend/src/ai_organizer/main.py
                            # alembic.ini is at: backend/alembic.ini
                            # So we need parents[2] (main.py -> ai_organizer -> src -> backend)
                            alembic_cfg_path = Path(__file__).resolve().parents[2] / "alembic.ini"
                            if alembic_cfg_path.exists():
                                config = Config(alembic_cfg_path)
                                config.set_main_option("script_location", str(alembic_cfg_path.parent / "alembic"))
                                script_dir = script.ScriptDirectory.from_config(config)
                                heads = script_dir.get_heads()
                                head_revision = heads[0] if heads else None
                                
                                if head_revision and current_revision != head_revision:
                                    has_pending_migrations = True
                                    migration_status_msg = f"⚠️  Pending migrations: current={current_revision}, head={head_revision}. Run: `alembic upgrade head`"
                                else:
                                    migration_status_msg = f"✅ Database is up-to-date (revision: {current_revision})"
                            else:
                                migration_status_msg = "ℹ️  Alembic config not found (migrations may be managed manually)"
                        except Exception as e:
                            logger.debug(f"Could not check migration status: {e}")
                            migration_status_msg = "ℹ️  Could not verify migration status (assuming OK)"
                    else:
                        # alembic_version table exists but is empty - migrations may not have been applied
                        has_pending_migrations = True
                        migration_status_msg = "⚠️  No migrations applied. Run: `alembic upgrade head`"
            except Exception as e:
                logger.debug(f"Could not check migration status: {e}")
                migration_status_msg = "ℹ️  Could not verify migration status (assuming OK)"
        else:
            # alembic_version table doesn't exist - migrations haven't been initialized
            has_pending_migrations = True
            migration_status_msg = "⚠️  Alembic version table not found. Run: `alembic upgrade head`"
        
    except Exception as e:
        logger.warning(
            f"⚠️  Could not verify database schema. Tables may be missing. "
            f"Please run migrations: `alembic upgrade head`. Error: {e}"
        )
        # Don't raise here - connection works, but schema might be incomplete
        # The app will fail on actual queries if schema is missing
        migration_status_msg = "⚠️  Could not verify database schema. Please check migrations."
    
    # Print summary for console output
    print(f"✅ Database connection verified at: {DB_URL}")
    if db_path:
        print(f"   Database file: {db_path}")
        print(f"   Database file exists: {db_path.exists()}")
    
    # Only show migration warning if there are pending migrations or missing critical tables
    if has_pending_migrations or missing_tables:
        print(f"   {migration_status_msg}")
    elif migration_status_msg:
        # Show status message even if everything is OK (but less prominently)
        print(f"   {migration_status_msg}")


# P1-2: Add exception handler for standardized error responses
app.add_exception_handler(HTTPException, error_response_handler)

# ✅ canonical API prefix
app.include_router(api_router, prefix="/api")

# ✅ Health endpoint is handled by api_router (routes/health.py)
# Removed duplicate endpoint to maintain single source of truth

# P3: Start background purge job
from ai_organizer.jobs.purge_job import purge_job

@app.on_event("startup")
async def startup_event():
    """Initialize background services on startup."""
    # Start the purge job if enabled
    if settings.AIORG_PURGE_ENABLED:
        await purge_job.start()
        print(f"🗑️  Purge job started (retention: {settings.AIORG_RETENTION_DAYS} days, "
              f"interval: {settings.AIORG_PURGE_INTERVAL_HOURS}h)")
    else:
        print("🗑️  Purge job disabled (AIORG_PURGE_ENABLED=false)")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup background services on shutdown."""
    # Stop the purge job
    await purge_job.stop()
    print("🗑️  Purge job stopped")

STATIC_DIR = Path(__file__).resolve().parents[3] / "static"

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    ico = STATIC_DIR / "favicon.ico"
    if ico.exists():
        return FileResponse(ico)
    svg = STATIC_DIR / "favicon.svg"
    return FileResponse(svg)
