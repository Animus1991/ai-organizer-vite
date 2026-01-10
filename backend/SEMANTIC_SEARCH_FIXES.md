# Semantic Search - spaCy Compatibility Fixes

## Problem
spaCy has compatibility issues with Python 3.14+ and Pydantic v2, causing `ConfigError: unable to infer type for attribute "REGEX"` when importing the module.

## Solution
Implemented **lazy import** and **graceful fallback** for spaCy:

### Changes Made

1. **Lazy Import (`semantic_search.py`)**:
   - Removed `import spacy` from module-level imports
   - Created `_try_import_spacy()` function that does lazy import only when needed
   - Catches all exceptions (not just ImportError) to handle compatibility issues

2. **Safe Module Import (`search.py`)**:
   - Changed from `from ai_organizer.services.semantic_search import ...` to `import ai_organizer.services.semantic_search as semantic_search_module`
   - Uses `getattr()` to safely get functions/objects (may be None if import failed)
   - Catches all exceptions (ImportError, ConfigError, etc.) for graceful fallback

3. **Function-Level Checks**:
   - All semantic search functions check if `semantic_search_fn is not None` before use
   - `expand_query_with_variations` falls back to synonyms-only if spaCy not available
   - `get_nlp_model` returns None if spaCy not available (graceful fallback)

## Result

✅ **Backend can now start successfully** even without spaCy installed
✅ **Semantic search works** with sentence-transformers (embeddings + synonyms)
✅ **Keyword variations disabled** if spaCy not available (lemmatization, plural/singular)
✅ **Synonyms still work** (custom + built-in, no spaCy required)

## Current Status

- ✅ sentence-transformers: Installed and working
- ⚠️ spaCy: Compatibility issue with Python 3.14+, but graceful fallback implemented
- ✅ Semantic search: Works without spaCy (embeddings + synonyms)
- ⚠️ Keyword variations: Requires spaCy (lemmatization, plural/singular, tenses)

## Testing

To test if backend starts:
```bash
cd backend
.\scripts\dev_bootstrap.ps1
```

Expected behavior:
- Backend should start successfully
- Warning message about spaCy compatibility (expected, not critical)
- Semantic search works with sentence-transformers (embeddings)
- Keyword variations work with synonyms (custom + built-in)

## Future Fixes

If spaCy compatibility is needed:
1. Wait for spaCy update with Python 3.14+ support
2. Use older Python version (3.11 or 3.12)
3. Use alternative NLP library compatible with Python 3.14+

## Notes

- Semantic search **works without spaCy** using sentence-transformers for embeddings
- Custom synonyms **always work** (no spaCy required)
- Keyword variations (lemmatization, plural/singular, tenses) **require spaCy**
- All features gracefully fall back if dependencies not available
