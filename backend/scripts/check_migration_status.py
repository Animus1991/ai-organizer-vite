#!/usr/bin/env python3
"""
Helper script to check Alembic migration status.
Returns the current revision and head revision for comparison.
"""
import sys
import os
from pathlib import Path

# Add backend/src to sys.path for imports
BASE_DIR = Path(__file__).resolve().parents[1]  # .../backend
SRC_DIR = BASE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

try:
    from ai_organizer.core.db import engine
    from sqlalchemy import text, inspect
    from alembic.config import Config
    from alembic import script
except ImportError as e:
    print(f"Failed to import: {e}")
    sys.exit(1)


def get_current_revision():
    """Get current database revision from alembic_version table."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            row = result.first()
            return row[0] if row else None
    except Exception:
        return None


def get_head_revision():
    """Get latest migration head revision from Alembic scripts."""
    try:
        alembic_cfg_path = BASE_DIR / "alembic.ini"
        if not alembic_cfg_path.exists():
            return None
        
        config = Config(alembic_cfg_path)
        config.set_main_option("script_location", str(BASE_DIR / "alembic"))
        
        script_dir = script.ScriptDirectory.from_config(config)
        heads = script_dir.get_heads()
        return heads[0] if heads else None
    except Exception:
        return None


def has_pending_migrations():
    """Check if there are pending migrations."""
    current = get_current_revision()
    head = get_head_revision()
    
    if current is None:
        # No migrations applied at all
        return True
    
    if head is None:
        # Can't determine head - assume OK
        return False
    
    return current != head


def check_missing_optional_tables():
    """Check if optional tables are missing (e.g., document_versions)."""
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        optional_tables = {"document_versions"}
        missing = optional_tables - existing_tables
        return list(missing) if missing else []
    except Exception:
        return []


if __name__ == "__main__":
    current = get_current_revision()
    head = get_head_revision()
    pending = has_pending_migrations()
    missing_optional = check_missing_optional_tables()
    
    print(f"Current revision: {current or 'None (no migrations applied)'}")
    print(f"Head revision: {head or 'Unknown'}")
    print(f"Pending migrations: {pending}")
    if missing_optional:
        print(f"Missing optional tables: {missing_optional}")
    
    sys.exit(1 if pending else 0)
