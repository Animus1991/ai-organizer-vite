#!/usr/bin/env python3
"""
Test script for semantic search API endpoints.
"""

import sys
import requests
import json
from typing import Dict, Any

API_BASE = "http://127.0.0.1:8000"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "testpassword123"

def login() -> str:
    """Login and get access token"""
    print("🔐 Logging in...")
    response = requests.post(
        f"{API_BASE}/api/auth/login",
        data={"username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token")
        if token:
            print("✅ Login successful")
            return token
        else:
            print(f"❌ Login failed: No access_token in response: {data}")
            sys.exit(1)
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        sys.exit(1)

def test_search(token: str, query: str, semantic: bool = False, lang: str = "auto", expand_variations: bool = True):
    """Test search endpoint"""
    print(f"\n🔍 Testing search: query='{query}', semantic={semantic}, lang={lang}, expand_variations={expand_variations}")
    
    params = {
        "q": query,
        "semantic": semantic,
        "lang": lang,
        "expand_variations": expand_variations,
        "limit": 10
    }
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{API_BASE}/api/search", params=params, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Search successful:")
            print(f"   Query: {data.get('query')}")
            print(f"   Total results: {data.get('total')}")
            print(f"   Semantic search used: {data.get('semantic', False)}")
            print(f"   Variations: {data.get('variations', [])}")
            print(f"   Results: {len(data.get('results', []))}")
            
            # Print first 3 results
            for i, result in enumerate(data.get('results', [])[:3], 1):
                print(f"   {i}. [{result.get('type')}] {result.get('title', 'N/A')[:50]}... (score: {result.get('score')})")
            
            return data
        else:
            print(f"❌ Search failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Search error: {e}")
        return None

def test_add_synonym(token: str, word: str, synonym: str):
    """Test add synonym endpoint"""
    print(f"\n➕ Testing add synonym: {word} <-> {synonym}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {"word": word, "synonym": synonym}
    
    try:
        response = requests.post(
            f"{API_BASE}/api/search/synonyms",
            json=payload,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Add synonym successful: {data.get('message')}")
            return data
        else:
            print(f"❌ Add synonym failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Add synonym error: {e}")
        return None

def test_list_synonyms(token: str, word: str = None):
    """Test list synonyms endpoint"""
    print(f"\n📋 Testing list synonyms{f' for word: {word}' if word else ' (all)'}")
    
    headers = {"Authorization": f"Bearer {token}"}
    params = {"word": word} if word else {}
    
    try:
        response = requests.get(
            f"{API_BASE}/api/search/synonyms",
            params=params,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ List synonyms successful:")
            synonyms = data.get('synonyms', {})
            if synonyms:
                for word, syn_list in synonyms.items():
                    print(f"   {word}: {', '.join(syn_list[:5])}{'...' if len(syn_list) > 5 else ''}")
            else:
                print("   No synonyms found")
            return data
        else:
            print(f"❌ List synonyms failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ List synonyms error: {e}")
        return None

def test_remove_synonym(token: str, word: str, synonym: str):
    """Test remove synonym endpoint"""
    print(f"\n➖ Testing remove synonym: {word} <-> {synonym}")
    
    headers = {"Authorization": f"Bearer {token}"}
    params = {"word": word, "synonym": synonym}
    
    try:
        response = requests.delete(
            f"{API_BASE}/api/search/synonyms",
            params=params,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Remove synonym successful: {data.get('message')}")
            return data
        else:
            print(f"❌ Remove synonym failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Remove synonym error: {e}")
        return None

def main():
    print("=" * 60)
    print("🧪 Semantic Search API Testing")
    print("=" * 60)
    
    # Login
    token = login()
    
    if not token:
        print("❌ Failed to get authentication token")
        sys.exit(1)
    
    # Test 1: Basic FTS5 search (no semantic)
    print("\n" + "=" * 60)
    print("TEST 1: Basic FTS5 Search (no semantic)")
    print("=" * 60)
    test_search(token, "document", semantic=False)
    
    # Test 2: Semantic search (if available)
    print("\n" + "=" * 60)
    print("TEST 2: Semantic Search")
    print("=" * 60)
    test_search(token, "document", semantic=True, lang="auto", expand_variations=True)
    
    # Test 3: Add custom synonyms
    print("\n" + "=" * 60)
    print("TEST 3: Custom Synonyms Management")
    print("=" * 60)
    test_add_synonym(token, "document", "file")
    test_add_synonym(token, "document", "paper")
    test_list_synonyms(token)
    test_list_synonyms(token, "document")
    
    # Test 4: Search with custom synonyms
    print("\n" + "=" * 60)
    print("TEST 4: Search with Custom Synonyms")
    print("=" * 60)
    test_search(token, "file", semantic=True, expand_variations=True)
    
    # Test 5: Remove synonym
    print("\n" + "=" * 60)
    print("TEST 5: Remove Synonym")
    print("=" * 60)
    test_remove_synonym(token, "document", "paper")
    test_list_synonyms(token, "document")
    
    # Test 6: Greek language detection (if query contains Greek characters)
    print("\n" + "=" * 60)
    print("TEST 6: Greek Language Detection")
    print("=" * 60)
    test_search(token, "έγγραφο", semantic=True, lang="auto", expand_variations=True)
    
    print("\n" + "=" * 60)
    print("✅ Testing completed!")
    print("=" * 60)

if __name__ == "__main__":
    main()
