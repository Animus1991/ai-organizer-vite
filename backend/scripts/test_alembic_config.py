#!/usr/bin/env python3
"""Test if Alembic config can be found and loaded"""
import sys
from pathlib import Path

# Add backend/src to sys.path
SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from pathlib import Path
from alembic.config import Config
from alembic import script

# Test the path calculation (same as in main.py)
main_file = Path("src/ai_organizer/main.py").resolve()
alembic_cfg_path = main_file.parents[2] / "alembic.ini"

print(f"main.py: {main_file}")
print(f"parents[0]: {main_file.parents[0].name}")
print(f"parents[1]: {main_file.parents[1].name}")
print(f"parents[2]: {main_file.parents[2].name}")
print(f"alembic.ini path: {alembic_cfg_path}")
print(f"Exists: {alembic_cfg_path.exists()}")

if alembic_cfg_path.exists():
    try:
        config = Config(alembic_cfg_path)
        config.set_main_option("script_location", str(alembic_cfg_path.parent / "alembic"))
        script_dir = script.ScriptDirectory.from_config(config)
        heads = script_dir.get_heads()
        print(f"Head revisions: {heads}")
        print("[PASS] Alembic config found and loaded successfully")
        sys.exit(0)
    except Exception as e:
        print(f"[FAIL] Error loading Alembic config: {e}")
        sys.exit(1)
else:
    print("[FAIL] Alembic config file not found")
    sys.exit(1)
