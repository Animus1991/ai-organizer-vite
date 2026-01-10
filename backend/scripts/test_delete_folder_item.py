#!/usr/bin/env python3
"""
Test script for delete_folder_item endpoint - P1-1 testing
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = BASE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

try:
    from sqlmodel import Session, select
    from sqlalchemy import func
    from ai_organizer.core.db import engine
    from ai_organizer.models import FolderItem, Folder
    
    print("Testing func.count() with SQLModel...")
    session = Session(engine)
    
    # Test count query
    result = session.exec(
        select(func.count(FolderItem.id)).where(FolderItem.folder_id == 99999)
    )
    print(f"Result type: {type(result)}")
    
    # Try .one()
    try:
        count_val = result.one()
        print(f"Result.one() type: {type(count_val)}")
        print(f"Result.one() value: {count_val}")
        if isinstance(count_val, tuple):
            print(f"  Is tuple with length {len(count_val)}")
            print(f"  First element: {count_val[0] if len(count_val) > 0 else None}")
    except Exception as e:
        print(f"Result.one() failed: {type(e).__name__}: {e}")
    
    # Try .first()
    try:
        result2 = session.exec(
            select(func.count(FolderItem.id)).where(FolderItem.folder_id == 99999)
        )
        count_val2 = result2.first()
        print(f"Result.first() type: {type(count_val2)}")
        print(f"Result.first() value: {count_val2}")
    except Exception as e:
        print(f"Result.first() failed: {type(e).__name__}: {e}")
    
    session.close()
    print("Test complete.")
    
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
