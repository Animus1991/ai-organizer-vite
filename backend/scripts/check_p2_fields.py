#!/usr/bin/env python3
"""Check if P2 research fields exist in segments table"""
import sys
from pathlib import Path

# Add backend/src to sys.path
SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from ai_organizer.core.db import engine
from sqlalchemy import inspect

try:
    inspector = inspect(engine)
    cols = [col['name'] for col in inspector.get_columns('segments')]
    print("Segments table columns:")
    print("  " + ", ".join(sorted(cols)))
    
    p2_fields = ['segment_type', 'evidence_grade', 'falsifiability_criteria']
    missing = [f for f in p2_fields if f not in cols]
    
    if missing:
        print(f"\n[WARN] Missing P2 fields: {', '.join(missing)}")
        print("       Run migration: alembic upgrade head")
        sys.exit(1)
    else:
        print("\n[PASS] All P2 fields exist")
        sys.exit(0)
except Exception as e:
    print(f"[FAIL] Error checking columns: {e}")
    sys.exit(1)
