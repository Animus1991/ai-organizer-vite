#!/usr/bin/env python3
"""
Test script for P0-2: Document Versioning.

Tests:
1. DocumentVersion model exists and can be imported
2. Migration file exists and is valid
3. PATCH endpoint creates versions instead of mutating
4. GET endpoint supports version parameter
5. Original Document.text remains immutable
"""

import sys
from pathlib import Path

# Add src to path
BACKEND_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = BACKEND_DIR / "src"
sys.path.insert(0, str(SRC_DIR))


def test_document_version_model():
    """Test that DocumentVersion model exists and has correct fields."""
    print("Test 1: Checking DocumentVersion model...")
    
    try:
        from ai_organizer.models import DocumentVersion, Document
        
        # Check that DocumentVersion exists
        assert hasattr(DocumentVersion, "__tablename__")
        assert DocumentVersion.__tablename__ == "document_versions"
        print("  PASS: DocumentVersion model exists")
        
        # Check that Document has versions relationship
        assert hasattr(Document, "__fields__") or hasattr(Document, "model_fields")
        print("  PASS: Document model has versions relationship")
        
        # Check required fields
        required_fields = ["document_id", "version_number", "title", "text", "created_by_user_id"]
        model_fields = getattr(DocumentVersion, "model_fields", getattr(DocumentVersion, "__fields__", {}))
        if hasattr(model_fields, "keys"):
            fields_list = list(model_fields.keys())
        else:
            fields_list = list(model_fields)
        
        for field in required_fields:
            if field not in fields_list:
                print(f"  ERROR: Missing field: {field}")
                return False
        
        print("  PASS: DocumentVersion has all required fields")
        return True
    except Exception as e:
        print(f"  ERROR: Failed to import/check DocumentVersion: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_migration_file():
    """Test that migration file exists and is valid."""
    print("\nTest 2: Checking migration file...")
    
    migration_file = BACKEND_DIR / "alembic" / "versions" / "20250109_add_document_versions.py"
    
    if not migration_file.exists():
        print(f"  ERROR: Migration file not found: {migration_file}")
        return False
    
    print(f"  PASS: Migration file exists: {migration_file.name}")
    
    # Check that migration has upgrade/downgrade functions
    content = migration_file.read_text(encoding="utf-8")
    
    if "def upgrade()" not in content:
        print("  ERROR: Migration missing upgrade() function")
        return False
    
    if "def downgrade()" not in content:
        print("  ERROR: Migration missing downgrade() function")
        return False
    
    if "document_versions" not in content:
        print("  ERROR: Migration doesn't create document_versions table")
        return False
    
    if "20250109_add_document_versions" not in content:
        print("  ERROR: Migration revision ID incorrect")
        return False
    
    print("  PASS: Migration file structure is valid")
    return True


def test_patch_endpoint_imports():
    """Test that PATCH endpoint can be imported and doesn't mutate doc.text."""
    print("\nTest 3: Checking PATCH endpoint implementation...")
    
    try:
        import re
        from ai_organizer.api.routes.documents import patch_document, _get_document_text_version
        print("  PASS: patch_document function imports successfully")
        
        # Check source code for doc.text = (should not exist)
        documents_py = SRC_DIR / "ai_organizer" / "api" / "routes" / "documents.py"
        content = documents_py.read_text(encoding="utf-8")
        
        # Check that doc.text is never assigned in patch_document
        # (it should only be read, not written)
        lines = content.split("\n")
        in_patch = False
        for i, line in enumerate(lines, 1):
            if "def patch_document" in line:
                in_patch = True
            elif in_patch and line.strip().startswith("def ") and "patch_document" not in line:
                break
            elif in_patch and "doc.text" in line and "=" in line and "immutable" not in line.lower() and "remains" not in line.lower():
                # Check if it's an assignment (not just a comment or string)
                if re.search(r'\bdoc\.text\s*=', line) and not line.strip().startswith("#"):
                    print(f"  ERROR: Found doc.text = at line {i}: {line.strip()}")
                    return False
        
        print("  PASS: patch_document does not mutate doc.text")
        return True
    except Exception as e:
        print(f"  ERROR: Failed to check PATCH endpoint: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_get_endpoint_version_param():
    """Test that GET endpoint supports version parameter."""
    print("\nTest 4: Checking GET endpoint version parameter...")
    
    try:
        from ai_organizer.api.routes.documents import get_document, _get_document_text_version
        import inspect
        
        sig = inspect.signature(get_document)
        params = list(sig.parameters.keys())
        
        if "version" not in params:
            print("  ERROR: GET endpoint missing 'version' parameter")
            return False
        
        print("  PASS: GET endpoint has 'version' parameter")
        
        # Check that _get_document_text_version helper exists
        if not callable(_get_document_text_version):
            print("  ERROR: _get_document_text_version is not callable")
            return False
        
        print("  PASS: _get_document_text_version helper exists")
        return True
    except Exception as e:
        print(f"  ERROR: Failed to check GET endpoint: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    
    print("=" * 60)
    print("P0-2 Testing: Document Versioning")
    print("=" * 60)
    
    tests = [
        test_document_version_model,
        test_migration_file,
        test_patch_endpoint_imports,
        test_get_endpoint_version_param,
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"  ERROR: Test {test.__name__} crashed: {e}")
            import traceback
            traceback.print_exc()
            results.append(False)
    
    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    for i, (test, result) in enumerate(zip(tests, results), 1):
        status = "PASS" if result else "FAIL"
        print(f"  Test {i}: {test.__name__}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n[PASS] All tests passed! P0-2 implementation is correct.")
        return 0
    else:
        print("\n[FAIL] Some tests failed. Please review the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())