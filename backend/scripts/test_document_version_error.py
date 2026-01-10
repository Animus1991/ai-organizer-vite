#!/usr/bin/env python3
"""
Test script to reproduce the 500 error when document_versions table doesn't exist.
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
    from sqlalchemy import inspect
    from sqlalchemy.exc import OperationalError
    from ai_organizer.core.db import engine
    from ai_organizer.models import Document, DocumentVersion
    from sqlmodel import Session, select
except ImportError as e:
    print(f"Failed to import: {e}")
    sys.exit(1)

print("Testing document_versions table handling...")
print()

# Check if table exists
inspector = inspect(engine)
tables = set(inspector.get_table_names())
print(f"Tables in database: {sorted(tables)}")
print(f"document_versions exists: {'document_versions' in tables}")
print()

# Test select on DocumentVersion model
print("Testing DocumentVersion select (should not crash if table doesn't exist)...")
session = Session(engine)
try:
    # Try to execute a query on DocumentVersion
    result = session.exec(select(DocumentVersion).limit(0)).all()
    print("✅ Select works (empty result)")
except OperationalError as e:
    print(f"OperationalError (expected if table doesn't exist): {type(e).__name__}: {str(e)[:100]}")
except Exception as e:
    print(f"Unexpected error: {type(e).__name__}: {str(e)[:100]}")
finally:
    session.close()

print()
print("Testing _get_document_text_version logic...")
# Get a document to test with
session = Session(engine)
try:
    doc = session.exec(select(Document).limit(1)).first()
    if doc:
        print(f"Found document ID {doc.id}, testing _get_document_text_version...")
        # Import the function
        from ai_organizer.api.routes.documents import _get_document_text_version
        try:
            title, text = _get_document_text_version(session, doc, None)
            print(f"SUCCESS: _get_document_text_version works: title='{title[:50]}...', text length={len(text)}")
        except Exception as e:
            print(f"FAILED: _get_document_text_version failed: {type(e).__name__}: {str(e)[:100]}")
            import traceback
            traceback.print_exc()
    else:
        print("No documents found in database")
except Exception as e:
    print(f"❌ Error getting document: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
finally:
    session.close()

print()
print("Test complete.")
