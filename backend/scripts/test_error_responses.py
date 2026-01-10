#!/usr/bin/env python3
"""
P1-2: Test Error Responses Consistency

Tests that all API endpoints return standardized error responses in the format:
{
    "code": "error_code_string",
    "message": "Human-readable error message",
    "details": { ... }  // Optional
}
"""
from __future__ import annotations

import sys
import json
from pathlib import Path

# Add backend/src to sys.path for imports
SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import requests

API_BASE = "http://127.0.0.1:8000"

def test_error_response_format(response: requests.Response, expected_status: int) -> bool:
    """Test that error response has standard format"""
    if response.status_code != expected_status:
        print(f"[FAIL] Expected status {expected_status}, got {response.status_code}")
        return False
    
    try:
        data = response.json()
    except Exception as e:
        print(f"[FAIL] Response is not JSON: {e}")
        print(f"   Response text: {response.text[:200]}")
        return False
    
    # Check for standard format
    if not isinstance(data, dict):
        print(f"[FAIL] Response is not a dict: {type(data)}")
        return False
    
    if "code" not in data:
        print(f"[FAIL] Missing 'code' field in response: {data}")
        return False
    
    if "message" not in data:
        print(f"[FAIL] Missing 'message' field in response: {data}")
        return False
    
    # 'details' is optional
    print(f"[PASS] Standard format: code='{data['code']}', message='{data['message']}'")
    if "details" in data:
        print(f"   Details: {data['details']}")
    
    return True

def test_401_unauthorized():
    """Test 401 Unauthorized error format"""
    print("\n[TEST] Testing 401 Unauthorized (no token)...")
    try:
        response = requests.get(f"{API_BASE}/api/uploads?page=1&pageSize=100")
        if test_error_response_format(response, 401):
            print("[PASS] 401 Unauthorized has standard format")
            return True
        else:
            print("[FAIL] 401 Unauthorized does not have standard format")
            return False
    except requests.exceptions.ConnectionError:
        print("[WARN] Backend not running. Start it with: python -m uvicorn ai_organizer.main:app --reload --app-dir src --port 8000")
        return None
    except Exception as e:
        print(f"[FAIL] Error testing 401: {e}")
        return False

def test_404_not_found():
    """Test 404 Not Found error format"""
    print("\n[TEST] Testing 404 Not Found (invalid document ID)...")
    try:
        # First, we need a valid token - skip if no auth
        # For now, test with a route that doesn't require auth
        response = requests.get(f"{API_BASE}/api/documents/999999")
        if response.status_code == 401:
            print("[WARN] Requires authentication - skipping 404 test")
            return None
        if test_error_response_format(response, 404):
            print("[PASS] 404 Not Found has standard format")
            return True
        else:
            print("[FAIL] 404 Not Found does not have standard format")
            return False
    except requests.exceptions.ConnectionError:
        print("[WARN] Backend not running")
        return None
    except Exception as e:
        print(f"[FAIL] Error testing 404: {e}")
        return False

def test_422_validation_error():
    """Test 422 Validation Error format"""
    print("\n[TEST] Testing 422 Validation Error (invalid mode)...")
    try:
        response = requests.post(f"{API_BASE}/api/documents/1/segment?mode=invalid_mode")
        if response.status_code == 401:
            print("[WARN] Requires authentication - skipping 422 test")
            return None
        if test_error_response_format(response, 422):
            print("[PASS] 422 Validation Error has standard format")
            return True
        else:
            print("[FAIL] 422 Validation Error does not have standard format")
            return False
    except requests.exceptions.ConnectionError:
        print("[WARN] Backend not running")
        return None
    except Exception as e:
        print(f"[FAIL] Error testing 422: {e}")
        return False

def main():
    print("=" * 60)
    print("P1-2: Testing Error Response Standardization")
    print("=" * 60)
    
    results = []
    
    # Test 401 (most common - no auth)
    result = test_401_unauthorized()
    if result is not None:
        results.append(("401 Unauthorized", result))
    
    # Test 404 (if we can get past auth)
    result = test_404_not_found()
    if result is not None:
        results.append(("404 Not Found", result))
    
    # Test 422 (if we can get past auth)
    result = test_422_validation_error()
    if result is not None:
        results.append(("422 Validation Error", result))
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary:")
    if results:
        passed = sum(1 for _, r in results if r)
        total = len(results)
        print(f"[PASS] Passed: {passed}/{total}")
        for name, result in results:
            status = "[PASS]" if result else "[FAIL]"
            print(f"   {status} {name}")
    else:
        print("[WARN] No tests could run (backend not running or requires auth)")
    
    print("=" * 60)
    
    if results and all(r for _, r in results):
        print("[PASS] All error responses use standard format!")
        return 0
    elif results:
        print("[FAIL] Some error responses do not use standard format")
        return 1
    else:
        print("[WARN] Could not complete testing")
        return 2

if __name__ == "__main__":
    sys.exit(main())
