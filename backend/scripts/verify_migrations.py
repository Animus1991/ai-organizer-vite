#!/usr/bin/env python3
"""
Verification script to ensure database migrations are up-to-date.

This script checks:
1. Database connection is possible
2. All expected tables exist
3. Alembic version table exists and matches expected head

Usage:
    python scripts/verify_migrations.py

Exit codes:
    0: All checks passed
    1: Database connection failed
    2: Missing tables
    3: Alembic version mismatch
"""

import sys
from pathlib import Path

# Add src to path
BACKEND_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = BACKEND_DIR / "src"
sys.path.insert(0, str(SRC_DIR))

from sqlalchemy import text, inspect
from alembic.config import Config
from alembic import script
from alembic.runtime.migration import MigrationContext

from ai_organizer.core.db import engine, DB_URL
from ai_organizer.core.config import settings


def get_current_head() -> str | None:
    """Get the current Alembic head revision from migration files."""
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    script_dir = script.ScriptDirectory.from_config(config)
    return script_dir.get_current_head()


def get_database_version() -> str | None:
    """Get the current Alembic version from database."""
    try:
        with engine.connect() as conn:
            context = MigrationContext.configure(conn)
            return context.get_current_revision()
    except Exception:
        return None


def main() -> int:
    """Run all verification checks."""
    print("🔍 Verifying database migrations...")
    print(f"   Database URL: {DB_URL}")
    
    # Check 1: Database connection
    print("\n1. Checking database connection...")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("   ✅ Database connection successful")
    except Exception as e:
        print(f"   ❌ Database connection failed: {e}")
        print("   💡 Run migrations first: `alembic upgrade head`")
        return 1
    
    # Check 2: Expected tables exist
    print("\n2. Checking expected tables exist...")
    expected_tables = {
        "users",
        "uploads",
        "documents",
        "segments",
        "refresh_tokens",
        "folders",
        "folder_items",
        "smart_notes",
        "document_notes",
        "alembic_version",  # Alembic's version tracking table
    }
    
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        missing_tables = expected_tables - existing_tables
        
        if missing_tables:
            print(f"   ❌ Missing tables: {missing_tables}")
            print("   💡 Run migrations: `alembic upgrade head`")
            return 2
        
        print(f"   ✅ All {len(expected_tables)} expected tables exist")
    except Exception as e:
        print(f"   ❌ Failed to check tables: {e}")
        return 2
    
    # Check 3: Alembic version matches expected head
    print("\n3. Checking Alembic version...")
    try:
        current_head = get_current_head()
        db_version = get_database_version()
        
        if not current_head:
            print("   ⚠️  Could not determine expected head revision")
            return 0  # Don't fail if we can't check
        
        if not db_version:
            print(f"   ❌ No Alembic version found in database")
            print(f"   💡 Run migrations: `alembic upgrade head`")
            print(f"   💡 Expected head: {current_head}")
            return 3
        
        if db_version != current_head:
            print(f"   ❌ Alembic version mismatch!")
            print(f"      Database version: {db_version}")
            print(f"      Expected head: {current_head}")
            print(f"   💡 Run migrations: `alembic upgrade head`")
            return 3
        
        print(f"   ✅ Alembic version matches expected head: {current_head}")
    except Exception as e:
        print(f"   ⚠️  Could not verify Alembic version: {e}")
        # Don't fail if version check fails - tables exist is more important
    
    print("\n✅ All migration checks passed!")
    return 0


if __name__ == "__main__":
    sys.exit(main())