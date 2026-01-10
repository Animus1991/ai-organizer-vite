# P0-2: Document Versioning Implementation

## Summary

Implemented provenance-safe document editing by creating version rows instead of mutating in-place. Original `Document.text` remains immutable.

## Changes Made

### 1. Added DocumentVersion Model
**File**: `backend/src/ai_organizer/models.py`
- **New Model**: `DocumentVersion`
  - Fields: `id`, `document_id`, `version_number`, `title`, `text`, `created_at`, `created_by_user_id`
  - Unique constraint: `(document_id, version_number)`
  - Relationships: `document`, `created_by_user`
- **Updated Model**: `Document`
  - Added relationship: `versions: list["DocumentVersion"]`
  - `Document.text` remains immutable (contains original text only)
- **Updated Model**: `User`
  - Added relationship: `document_versions: list["DocumentVersion"]`

### 2. Created Alembic Migration
**File**: `backend/alembic/versions/20250109_add_document_versions.py`
- **Revision ID**: `20250109_add_document_versions`
- **Revises**: `20250108180000` (workspace models)
- Creates `document_versions` table with:
  - Foreign keys to `documents.id` and `users.id`
  - Unique constraint on `(document_id, version_number)`
  - Indexes on `document_id`, `version_number`, `created_by_user_id`

### 3. Updated PATCH Endpoint
**File**: `backend/src/ai_organizer/api/routes/documents.py`
- **Function**: `patch_document()`
- **Before**: Mutated `doc.text` in-place (`doc.text = payload.text`)
- **After**: Creates new `DocumentVersion` row
  - Gets current version (latest or original)
  - Compares new vs current to avoid redundant versions
  - Creates new version with `version_number = max_version + 1` (or 1 if no versions)
  - `Document.text` remains immutable (never mutated)
  - `Document.title` can be updated (for display purposes)
- **Behavior**:
  - If no changes detected → no version created (prevents redundant versions)
  - If changes detected → new version created
  - Returns latest version (just created or existing)

### 4. Updated GET Endpoint
**File**: `backend/src/ai_organizer/api/routes/documents.py`
- **Function**: `get_document()`
- **Added Parameter**: `version: int | None = Query(default=None)`
- **Added Helper**: `_get_document_text_version()`
  - `version=None` → returns latest version (or original if no versions)
  - `version=0` → returns original `Document.text` (never edited)
  - `version=X` → returns specific version number
- **Behavior**:
  - Default (no version param) → latest version
  - `?version=0` → original document text
  - `?version=X` → specific version (404 if not found)

### 5. Segmentation Endpoint (No Changes)
**File**: `backend/src/ai_organizer/api/routes/segment.py`
- **Status**: No changes needed
- **Reason**: Segmentation uses `doc.text` (original), which is correct for backward compatibility
- **Future Enhancement**: Can add version parameter to segmentation endpoint (P2, not P0)

## Architecture Compliance

✅ **Provenance Invariant**: Original `Document.text` is immutable  
✅ **Version Creation**: Editing creates `DocumentVersion` rows  
✅ **Backward Compatibility**: GET without version param returns latest (or original if no versions)  
✅ **Traceability**: Every version tracks `created_by_user_id` and `created_at`

## Files Changed

- `backend/src/ai_organizer/models.py` - Added `DocumentVersion` model, updated relationships
- `backend/alembic/versions/20250109_add_document_versions.py` - New migration
- `backend/src/ai_organizer/api/routes/documents.py` - Updated PATCH and GET endpoints

## Verification

✅ **Code Compiles**: All files compile without errors  
✅ **Linter Clean**: No linter errors  
✅ **Imports Work**: All functions import successfully  
✅ **No Mutations**: No `doc.text =` assignments in routes (only in models, which is OK)

## Testing Required

- [ ] Run migration: `alembic upgrade head` → should create `document_versions` table
- [ ] Create document → verify no versions exist
- [ ] Edit document (PATCH) → verify version created, original `Document.text` unchanged
- [ ] GET document (no version) → returns latest version
- [ ] GET document with `?version=0` → returns original text
- [ ] GET document with `?version=1` → returns version 1 (if exists)
- [ ] Multiple edits → verify sequential version numbers (1, 2, 3, ...)
- [ ] No-op edit (same text) → no version created
- [ ] Segmentation still works (uses original `doc.text`)

## Breaking Changes

**None** - Backward compatible:
- Frontend doesn't need changes (default behavior returns latest version)
- Segmentation endpoint unchanged (uses original text)
- Existing documents work (no versions = returns original text)

## Next Steps

Ready for P0-3: Fork-on-Edit for Auto Segments

---

**Last Updated**: 2025-01-XX  
**Status**: Implementation Complete, Testing Pending