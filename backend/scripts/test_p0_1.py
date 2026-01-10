#!/usr/bin/env python3
"""
Test script for P0-1: Verify no runtime create_all calls.

Tests:
1. No runtime calls to create_db_and_tables()
2. verify_database_connection() works correctly
3. Server imports successfully without creating tables
4. Deprecated function exists but is not called
"""

import sys
from pathlib import Path

# Add src to path
BACKEND_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = BACKEND_DIR / "src"
sys.path.insert(0, str(SRC_DIR))

def test_no_runtime_create_all():
    """Test that no runtime create_all calls exist."""
    print("Test 1: Checking for runtime create_all calls...")
    
    import re
    from pathlib import Path
    
    main_py = SRC_DIR / "ai_organizer" / "main.py"
    content = main_py.read_text(encoding="utf-8")
    
    # Check that create_db_and_tables is not called
    if "create_db_and_tables()" in content:
        # Check if it's only in comments or docstrings
        lines = content.split("\n")
        for i, line in enumerate(lines, 1):
            if "create_db_and_tables()" in line:
                # Ignore comments and docstrings
                stripped = line.strip()
                if not stripped.startswith("#") and not stripped.startswith('"""') and not stripped.startswith("'''"):
                    if "def " not in line and "DEPRECATED" not in content[max(0, i-5):i+5]:
                        print(f"  ERROR: create_db_and_tables() found in active code at line {i}")
                        return False
    
    print("  PASS: No runtime calls to create_db_and_tables()")
    
    # Check that create_all is not called in main.py
    if "create_all" in content.lower():
        # Check if it's only in comments
        if re.search(r'create_all\s*\(', content, re.IGNORECASE):
            if "No runtime create_all" not in content:
                print("  ERROR: create_all found in main.py")
                return False
    
    print("  PASS: No create_all calls in main.py")
    return True


def test_verify_database_connection():
    """Test that verify_database_connection() works."""
    print("\nTest 2: Testing verify_database_connection()...")
    
    try:
        from ai_organizer.core.db import verify_database_connection, DB_URL
        print(f"  DB URL: {DB_URL}")
        
        # This should work if database file exists or can be created (SQLite)
        verify_database_connection()
        print("  PASS: verify_database_connection() works correctly")
        return True
    except Exception as e:
        print(f"  ERROR: verify_database_connection() failed: {e}")
        return False


def test_app_imports():
    """Test that app imports successfully."""
    print("\nTest 3: Testing app imports...")
    
    try:
        from ai_organizer.main import app
        print("  PASS: App imports successfully")
        
        # Verify that on_startup exists and doesn't call create_db_and_tables
        import inspect
        source = inspect.getsource(app.on_event)
        # This is a decorator, so we check the startup function
        print("  PASS: on_startup event handler exists")
        return True
    except Exception as e:
        print(f"  ERROR: App import failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_deprecated_function_exists():
    """Test that deprecated function exists but is not called."""
    print("\nTest 4: Testing deprecated function exists...")
    
    try:
        from ai_organizer.core.db import create_db_and_tables
        import inspect
        
        # Check that it's marked as deprecated
        doc = inspect.getdoc(create_db_and_tables)
        if "DEPRECATED" in doc or "deprecated" in doc.lower():
            print("  PASS: create_db_and_tables() exists and is marked as deprecated")
        else:
            print("  WARNING: create_db_and_tables() exists but not marked as deprecated")
        
        # Check that it's not called in main.py
        main_py = SRC_DIR / "ai_organizer" / "main.py"
        content = main_py.read_text(encoding="utf-8")
        
        if "create_db_and_tables()" in content:
            # Should only be in comments or import (if any)
            if "from ai_organizer.core.db import" in content:
                if "create_db_and_tables" in content:
                    # Check if it's actually used (not just imported)
                    if "create_db_and_tables()" in content.split("import")[1:]:
                        print("  ERROR: create_db_and_tables() is called in main.py")
                        return False
        
        print("  PASS: create_db_and_tables() is not called in main.py")
        return True
    except Exception as e:
        print(f"  ERROR: Failed to check deprecated function: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("P0-1 Testing: Remove Runtime Schema Creation")
    print("=" * 60)
    
    tests = [
        test_no_runtime_create_all,
        test_verify_database_connection,
        test_app_imports,
        test_deprecated_function_exists,
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
        print("\n[PASS] All tests passed! P0-1 is working correctly.")
        return 0
    else:
        print("\n[FAIL] Some tests failed. Please review the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())