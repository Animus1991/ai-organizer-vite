# Comprehensive Architecture Audit - AI Organizer
**Date**: 2025-01-XX  
**Auditor**: Architecture Review Team  
**Scope**: Full codebase (Frontend + Backend)  
**Goal**: Complete capability matrix, incompatibility analysis, deprecation plan, and prioritized roadmap

---

## EXECUTIVE SUMMARY

### Current State Assessment
- ✅ **Core MVP Working**: Upload, parse, segment, auth, basic CRUD operations functional
- ⚠️ **Stability Issues**: Multiple P0 violations (runtime schema creation, potential race conditions)
- ❌ **Missing Critical Features**: Provider-agnostic AI layer, research-grade typing/grading/linking, versioning system
- 🔴 **Known Bug**: Folder UI sync issue - empty folders not auto-deleted by backend, frontend filtering inconsistent

### Critical Findings
1. **P0 VIOLATION**: `create_db_and_tables()` called in `main.py` startup conflicts with Alembic migrations
2. **P0 VIOLATION**: Health endpoint appears to be correctly under `/api/health` (audit needs verification)
3. **P1 ISSUE**: Folder empty state handling - backend doesn't auto-delete empty folders, frontend filtering race condition
4. **P1 ISSUE**: Error responses partially machine-readable (422 for uploads OK, but other endpoints use plain strings)
5. **P2 MISSING**: Research-grade features (typing, grading, linking, versioning) not implemented
6. **P3 MISSING**: Provider-agnostic AI layer not implemented (but correctly avoided vendor lock-in)

---

## 1. CAPABILITY MATRIX

| Architecture Goal | Status | Implementation Location | Notes / Issues |
|-------------------|--------|------------------------|----------------|
| **A) API Routing Conventions** |
| `/api/*` prefix for all endpoints | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/main.py:115` | `app.include_router(api_router, prefix="/api")` |
| Health endpoint at `/api/health` only | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/api/routes/health.py:5` | `@router.get("/health")` → mounted at `/api/health` |
| `/health` returns 404 | ⚠️ **VERIFY** | `main.py` | No duplicate endpoint found - need to verify with curl |
| OpenAPI shows `/api/*` only | ⚠️ **VERIFY** | `main.py` | Need to check OpenAPI schema |
| **B) Database Backbone** |
| Alembic migrations as source of truth | ⚠️ **VIOLATED** | `backend/src/ai_organizer/main.py:70` | `create_db_and_tables()` called on startup - **P0 VIOLATION** |
| Single DB URL for app + Alembic | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/core/config.py`, `alembic/env.py:30-47` | Both use `settings.AIORG_DB_URL` |
| Segment stable linking (start_char/end_char) | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/models.py:103-127` | `start_char`, `end_char` fields, `order_index` for ordering |
| **C) Ingest + Parse Rules** |
| Unsupported file types → 422 with structured error | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/api/routes/upload.py:246-263` | `UploadError` with `code`, `message`, `supported_extensions` |
| Parse status tracking | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/models.py:81-83` | `parse_status`, `parse_error` fields |
| Only write processed artifacts if parsing succeeded | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/api/routes/upload.py:344-355` | Conditional `processed_path` assignment |
| **D) Core API Contract** |
| POST `/api/upload` → create upload + document | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/api/routes/upload.py:235` | Working |
| POST `/api/documents/{id}/segment` → run segmentation | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/api/routes/segment.py:48` | Working |
| GET `/api/documents/{id}/segments` → deterministic ordered list | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/api/routes/segment.py:266` | Uses `order_by(Segment.order_index.asc(), Segment.id.asc())` |
| Auth endpoints under `/api/auth/*` | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/api/router.py:18` | `prefix="/auth"` → `/api/auth/*` |
| **E) Segmentation Strategies** |
| QA segmentation (deterministic) | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/ingest/segmenters.py:15` | Uses regex pattern matching, deterministic |
| Paragraph segmentation (deterministic) | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/ingest/segmenters.py:90` | Uses regex, deterministic |
| Stable ordering via `order_index` | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/api/routes/segment.py:109,293` | `order_index` assigned sequentially |
| Date-block segmentation | ❌ **NOT IMPLEMENTED** | N/A | Not in `segmenters.py` |
| Keyword-based slicing | ❌ **NOT IMPLEMENTED** | N/A | Not in `segmenters.py` |
| Baseline search (FTS) | ❌ **NOT IMPLEMENTED** | `backend/alembic/versions/add_fts_tables.py` exists but not used | Migration exists, but no endpoints |
| **F) Frontend Page Architecture** |
| Auth entry + protected routes | ✅ **IMPLEMENTED** | `src/auth/ProtectedRoute.tsx`, `src/pages/App.tsx` | React Router with `ProtectedRoute` |
| Home: upload → select mode → segment → list | ✅ **IMPLEMENTED** | `src/pages/Home.tsx` | Working |
| Document detail route `/documents/:id` | ✅ **IMPLEMENTED** | `src/pages/DocumentViewer.tsx`, `src/pages/DocumentWorkspace.tsx` | Both exist |
| **G) JWT Auth + Auto Refresh** |
| Axios interceptors add Authorization | ✅ **IMPLEMENTED** | `src/api/apiClient.ts:15-22` | Request interceptor adds `Bearer {token}` |
| On 401: ONE refresh call (lock/queue) | ⚠️ **PARTIAL** | `src/api/apiClient.ts:44`, `src/lib/api.ts:76-117` | Two implementations - need consolidation |
| If refresh fails: logout + redirect | ✅ **IMPLEMENTED** | `src/api/apiClient.ts:52-54,64-66` | `clearTokens()` + `auth:token-expired` event |
| **H) Segment List Quality-of-Life** |
| Filter by mode | ✅ **IMPLEMENTED** | `src/components/workspace/WorkspaceFilters.tsx` | Working |
| Search across title/content | ✅ **IMPLEMENTED** | `src/components/SearchModal.tsx`, `src/lib/searchUtils.ts` | Global search implemented |
| Multi-select + bulk actions | ✅ **IMPLEMENTED** | `src/components/BatchOperations.tsx` | Working |
| **I) Reusable UI Components + Hooks** |
| Components: header, status badge, docs list, segments list, drawer, modal, error banner | ✅ **IMPLEMENTED** | `src/components/` | Well-organized component library |
| Hooks: useApi, useDocument, useSegments | ✅ **IMPLEMENTED** | `src/hooks/` | Custom hooks for business logic |
| **J) Document Editor as Derived Copy** |
| Source immutable | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/models.py:64-101` | `Document.text` is not mutated (PATCH creates new version?) |
| Edit creates derived version row | ❌ **NOT IMPLEMENTED** | N/A | `PATCH /documents/{id}` mutates in-place - **VIOLATION** |
| Re-segmentation can run on derived versions | ❌ **NOT IMPLEMENTED** | N/A | No version system |
| Export: Markdown/Text | ✅ **IMPLEMENTED** | `src/lib/export.ts` | Multiple formats supported |
| Export: DOCX | ❌ **NOT IMPLEMENTED** | N/A | Not in `export.ts` |
| **K) Generic Rich Text Editor** |
| One editor UI for documents and segments | ✅ **IMPLEMENTED** | `src/editor/RichTextEditor.tsx` | TipTap-based editor |
| Fork-on-edit for auto segments | ⚠️ **PARTIAL** | `src/pages/DocumentWorkspace.tsx` | Manual segments can be created, but auto segments can be edited in-place - **POTENTIAL VIOLATION** |
| **L) Soft Delete + Recycle Bin + Retention** |
| Soft delete sets `deleted_at` | ❌ **NOT IMPLEMENTED** | N/A | No `deleted_at` field in models |
| Recycle bin lists deleted | ⚠️ **PARTIAL** | `src/components/RecycleBinDrawer.tsx` | Uses `localStorage` for chunks only, not segments |
| Restore endpoints | ❌ **NOT IMPLEMENTED** | N/A | No backend endpoints |
| Purge after X days | ❌ **NOT IMPLEMENTED** | N/A | No retention policy |
| **M) Library Layer + Folders/Subfolders** |
| Separate "library item" layer | ✅ **IMPLEMENTED** | `backend/src/ai_organizer/models.py:220-243` | `FolderItem` model references segments/chunks |
| Folder tree, ordering, drag/drop | ✅ **IMPLEMENTED** | `src/components/FolderManagerDrawer.tsx`, `src/components/FolderDropZone.tsx` | Working |
| Cloning preserves provenance | ⚠️ **PARTIAL** | `src/lib/chunkDuplication.ts` | Duplicated chunks stored in `localStorage`, not in database |
| Empty folder cleanup | ❌ **NOT IMPLEMENTED** | `backend/src/ai_organizer/api/routes/workspace.py:320-339` | `delete_folder_item` doesn't check if folder becomes empty - **BUG** |
| **N) Persistence & Repeatability** |
| Refresh/reopen shows same results | ⚠️ **PARTIAL** | `backend/src/ai_organizer/api/routes/segment.py:293` | Ordering is deterministic, but cache invalidation might cause issues |
| Stable ordering, stable metadata | ✅ **IMPLEMENTED** | `order_index` + `id` ordering | Working |
| Minimal smoke tests | ⚠️ **PARTIAL** | `backend/scripts/smoke_flow.py` | Exists but needs enhancement |
| **O) Repo Hygiene / CI** |
| Clear README | ✅ **IMPLEMENTED** | `README.md` | Good documentation |
| Dependency locks | ✅ **IMPLEMENTED** | `package-lock.json`, `backend/requirements.txt` | Present |
| `.env.example` | ❌ **MISSING** | N/A | Should add |
| Correct `.gitignore` | ✅ **IMPLEMENTED** | `.gitignore` | Looks correct |
| Minimal CI: build frontend + run backend tests | ✅ **IMPLEMENTED** | `.github/workflows/ci.yml` | Vitest for frontend, but backend tests need verification |
| **P) Research-Grade Scientific Backbone** |
| Segment typing (Definition, Claim, etc.) | ❌ **NOT IMPLEMENTED** | N/A | No `segment_type` field |
| Evidence grading (E0–E4) | ❌ **NOT IMPLEMENTED** | N/A | No `evidence_level` field |
| Falsifiability tracker | ❌ **NOT IMPLEMENTED** | N/A | No fields for falsifiability |
| Linking graph (claim ↔ evidence, etc.) | ❌ **NOT IMPLEMENTED** | N/A | No `Link` model |
| Outline builder | ⚠️ **PARTIAL** | `src/components/OutlineWizard.tsx` | UI exists, but no persistence/export |
| **Q) Optional Intelligence Layer** |
| Provider-agnostic LLM interface | ❌ **NOT IMPLEMENTED** | N/A | Correctly avoided vendor lock-in |
| FTS baseline | ⚠️ **PARTIAL** | `backend/alembic/versions/add_fts_tables.py` | Migration exists, but no endpoints |
| Embeddings + semantic search | ❌ **NOT IMPLEMENTED** | N/A | Correctly deferred |
| LLM suggestions with provenance | ❌ **NOT IMPLEMENTED** | N/A | Correctly deferred |

---

## 2. INCOMPATIBILITIES & BUG RISKS (Ordered by Severity)

### P0 - CRITICAL (Must Fix First)

#### P0-1: Runtime Schema Creation Conflicts with Alembic
**Location**: `backend/src/ai_organizer/main.py:56-73`  
**Issue**: `create_db_and_tables()` called on startup uses `SQLModel.metadata.create_all(engine)`, which can conflict with Alembic migrations if schema drifts.

**Risk**:
- If Alembic migration adds column, but model doesn't have it yet → `create_all` won't create it → app crashes
- If Alembic migration removes column, but model still has it → `create_all` won't remove it → app works but DB inconsistent
- Fresh clone → `alembic upgrade head` → run works, but second run after code change might fail

**Fix**: Remove `create_db_and_tables()` from startup. Use Alembic exclusively:
```python
# REMOVE from main.py:
create_db_and_tables()

# REPLACE with:
# Ensure migrations are up to date (run alembic upgrade head in deployment)
# Or add a startup check that verifies DB schema matches migrations
```

**Acceptance Criteria**:
- Fresh clone → `alembic upgrade head` → run works
- Code change → migration → run works
- No `create_all` calls anywhere

**Verification**:
```bash
cd backend
rm data/app.db
alembic upgrade head
python -m uvicorn ai_organizer.main:app --reload
# Should start without errors
# Check logs - no "create_all" messages
```

#### P0-2: Document Edit Mutates Source (Provenance Violation)
**Location**: `backend/src/ai_organizer/api/routes/documents.py:69-75`  
**Issue**: `PATCH /documents/{id}` mutates `Document.text` in-place, violating provenance invariant.

**Risk**: Original text lost, cannot trace edits back to source, breaks re-segmentation on original.

**Fix**: Implement versioning system:
1. Add `DocumentVersion` model
2. `PATCH /documents/{id}` creates new `DocumentVersion` row
3. Original `Document.text` remains immutable
4. Re-segmentation can run on specific version

**Acceptance Criteria**:
- Edit document → new version row created
- Original `Document.text` unchanged
- GET `/api/documents/{id}` returns latest version (or specific version with `?version=X`)

**Verification**:
```bash
# Create document
POST /api/upload → document_id=1

# Get original text
GET /api/documents/1 → text="original"

# Edit document
PATCH /api/documents/1 {"text": "edited"} → version_id=2

# Get latest version (should be edited)
GET /api/documents/1 → text="edited"

# Get original version (should be original)
GET /api/documents/1?version=1 → text="original"
```

#### P0-3: Auto Segment Edit Mutates Source (Provenance Violation)
**Location**: `backend/src/ai_organizer/api/routes/segment.py:200-237`  
**Issue**: `PATCH /segments/{id}` can mutate auto-generated segments in-place, breaking re-segmentation determinism.

**Risk**: Re-segmentation after edit → original segments lost, cannot restore.

**Fix**: Fork-on-edit:
1. `PATCH /segments/{id}` where `is_manual=False` → create new `Segment` with `is_manual=True`, copy content
2. Original auto segment remains unchanged
3. Re-segmentation only affects `is_manual=False` segments

**Acceptance Criteria**:
- Edit auto segment → new manual segment created, original unchanged
- Re-segmentation → original auto segments restored, manual segments preserved

**Verification**:
```bash
# Create auto segments
POST /api/documents/1/segment?mode=qa → segments created

# Get auto segment
GET /api/segments/1 → isManual=false

# Edit auto segment
PATCH /api/segments/1 {"content": "edited"} → new segment_id=2, isManual=true

# Re-segment
POST /api/documents/1/segment?mode=qa → original segment 1 restored, segment 2 preserved
```

### P1 - HIGH PRIORITY (Core Determinism + UX Stability)

#### P1-1: Folder Empty State Handling Bug (Current Issue)
**Location**: `backend/src/ai_organizer/api/routes/workspace.py:320-339`, `src/pages/DocumentWorkspace.tsx`  
**Issue**: Backend doesn't auto-delete empty folders when last item is deleted. Frontend tries to filter empty folders, but race conditions cause inconsistent state.

**Root Cause Analysis**:
1. `delete_folder_item` in `workspace.py:320` only deletes the item, doesn't check if folder becomes empty
2. Frontend `loadFolderMap` relies on `getFolder` to get folder items
3. Cache invalidation happens, but timing issues cause stale data
4. `filterFoldersWithItems` in frontend tries to filter, but `loadFolderMap` might return cached empty folder data

**Fix Options**:
- **Option A (Recommended)**: Backend auto-deletes empty folders after item deletion
- **Option B**: Backend returns `itemCount` in folder list, frontend filters on client-side
- **Option C**: Backend endpoint `/api/workspace/folders/{id}/items/count` for efficient checking

**Recommended Fix (Option A)**:
```python
@router.delete("/folder-items/{item_id}")
def delete_folder_item(...):
    # ... existing deletion code ...
    session.delete(item)
    session.commit()
    
    # Check if folder is now empty
    remaining_items = session.exec(
        select(func.count(FolderItem.id)).where(FolderItem.folder_id == folder.id)
    ).scalar()
    
    if remaining_items == 0:
        session.delete(folder)
        session.commit()
        # Return indication that folder was deleted
        return {"ok": True, "folder_deleted": True, "folder_id": folder.id}
    
    return {"ok": True, "folder_deleted": False}
```

**Frontend Fix**: Update `onChunkUpdated` to handle `folder_deleted` response:
```typescript
// In confirmDeleteChunk (FolderView.tsx)
const response = await deleteFolderItem(item.id);
if (response.folder_deleted) {
  // Folder was auto-deleted by backend
  // Trigger parent refresh immediately
  await onChunkUpdated();
}
```

**Acceptance Criteria**:
- Delete last chunk from folder → folder deleted from backend
- "All folders" dropdown updates immediately
- Empty folders never appear in dropdown
- No race conditions or stale cache

**Verification**:
```bash
# Create folder with chunk
POST /api/workspace/folders → folder_id=1
POST /api/workspace/folder-items → item_id=1

# Delete last item
DELETE /api/workspace/folder-items/1 → folder_deleted=true

# Verify folder is deleted
GET /api/workspace/documents/1/folders → folder_id=1 not in response
```

#### P1-2: Error Response Consistency
**Location**: Multiple backend routes  
**Issue**: Only upload errors use structured `{code, message, supported_extensions}` format. Other endpoints use plain strings in `detail`.

**Fix**: Standardize all error responses:
```python
class APIError(BaseModel):
    code: str
    message: str
    details: dict | None = None

# Use in all HTTPException:
raise HTTPException(
    status_code=404,
    detail=APIError(
        code="not_found",
        message="Document not found",
        details={"document_id": document_id}
    ).dict()
)
```

**Acceptance Criteria**:
- All errors return `{code, message, details?}` structure
- Frontend can programmatically handle errors by code

**Verification**:
```bash
# Test various error scenarios
GET /api/documents/999 → 404 with structured error
POST /api/upload (invalid file) → 422 with structured error
POST /api/auth/login (wrong password) → 401 with structured error
```

#### P1-3: Refresh Token Race Condition (Multiple Implementations)
**Location**: `src/api/apiClient.ts:44`, `src/lib/api.ts:76-117`  
**Issue**: Two different refresh mechanisms exist, potential for race conditions.

**Fix**: Consolidate to single implementation in `apiClient.ts`, remove duplicate from `api.ts`.

**Acceptance Criteria**:
- Single refresh lock/queue mechanism
- Concurrent requests share same refresh promise
- No duplicate refresh calls

**Verification**:
- Rapid concurrent API calls → only one refresh call made
- Refresh fails → tokens cleared, user logged out

### P2 - MEDIUM PRIORITY (Research Backbone)

#### P2-1: Missing Segment Typing System
**Location**: N/A (not implemented)  
**Issue**: No way to classify segments as Definition, Claim, Evidence, etc.

**Fix**: Add `SegmentType` enum and `segment_type` field to `Segment` model.

#### P2-2: Missing Evidence Grading System
**Location**: N/A (not implemented)  
**Issue**: No way to grade evidence quality (E0–E4).

**Fix**: Add `EvidenceGrade` enum and `evidence_level` field (for claim segments).

#### P2-3: Missing Linking Graph
**Location**: N/A (not implemented)  
**Issue**: No way to link segments (claim ↔ evidence, claim ↔ counterargument, etc.).

**Fix**: Add `Link` model with `source_segment_id`, `target_segment_id`, `link_type` (supports, contradicts, depends_on, etc.).

### P3 - LOW PRIORITY (Library/Folders Enhancement)

#### P3-1: Soft Delete + Recycle Bin
**Location**: N/A (not implemented)  
**Issue**: No soft delete, items permanently deleted.

**Fix**: Add `deleted_at` field to relevant models, implement restore endpoints.

#### P3-2: Retention Policy
**Location**: N/A (not implemented)  
**Issue**: No automatic cleanup of old deleted items.

**Fix**: Add background task to purge items where `deleted_at < now() - retention_days`.

---

## 3. DEPRECATION / REMOVAL PLAN

### High Priority Removals (P0)

1. **Remove `create_db_and_tables()` from `main.py` startup** (P0-1)
   - **Why**: Conflicts with Alembic, causes schema drift, breaks determinism
   - **Risk**: High - can cause production issues
   - **Action**: Remove call, add migration verification check if needed

2. **Deprecate in-place document editing** (P0-2)
   - **Why**: Violates provenance invariant
   - **Risk**: High - data loss, cannot trace edits
   - **Action**: Implement versioning system, mark old endpoint as deprecated

3. **Deprecate in-place auto segment editing** (P0-3)
   - **Why**: Breaks re-segmentation determinism
   - **Risk**: High - cannot restore original segments
   - **Action**: Implement fork-on-edit, mark old endpoint as deprecated

### Medium Priority Removals (P1)

4. **Consolidate refresh token mechanisms** (P1-3)
   - **Why**: Duplicate code, potential race conditions
   - **Risk**: Medium - can cause auth issues
   - **Action**: Keep `apiClient.ts` implementation, remove from `api.ts`

### Low Priority Cleanup (P2)

5. **Remove duplicate health endpoint** (if exists)
   - **Why**: Single source of truth violation
   - **Risk**: Low - already under `/api/health`
   - **Action**: Verify no duplicate, remove if found

6. **Clean up unused localStorage fallbacks**
   - **Why**: Folders now fully in database, localStorage fallback is legacy
   - **Risk**: Low - might be needed for offline scenarios
   - **Action**: Document when to remove, keep for now if offline support needed

---

## 4. PRIORITIZED ROADMAP

### PHASE P0: Correctness/Blockers (Must Fix First)

#### P0-1: Remove Runtime Schema Creation
**Goal**: Eliminate `create_db_and_tables()` from startup, use Alembic exclusively.

**Files to Touch**:
- `backend/src/ai_organizer/main.py` (remove `create_db_and_tables()` call)
- `backend/src/ai_organizer/core/db.py` (keep function for migration verification if needed)

**Acceptance Criteria**:
- ✅ Fresh clone → `alembic upgrade head` → run works
- ✅ No `create_all` calls in runtime code
- ✅ Schema changes only via Alembic migrations

**Verification Steps**:
```bash
# 1. Fresh database test
cd backend
rm data/app.db
alembic upgrade head
python -m uvicorn ai_organizer.main:app --reload
# Should start without errors

# 2. Verify no create_all in logs
grep -r "create_all" backend/src/ai_organizer/
# Should return no results (or only in comments)

# 3. Schema change test
# Create new migration
alembic revision --autogenerate -m "test_change"
# Edit migration (add test column)
alembic upgrade head
# Run app - should work with new schema
```

**Estimated Effort**: 1-2 hours

#### P0-2: Implement Document Versioning
**Goal**: Make document editing provenance-safe by creating version rows instead of mutating in-place.

**Files to Touch**:
- `backend/src/ai_organizer/models.py` (add `DocumentVersion` model)
- `backend/alembic/versions/` (create migration)
- `backend/src/ai_organizer/api/routes/documents.py` (modify PATCH endpoint)
- `src/lib/api.ts` (update frontend API calls if needed)

**Acceptance Criteria**:
- ✅ `PATCH /documents/{id}` creates new `DocumentVersion` row
- ✅ Original `Document.text` remains immutable
- ✅ `GET /api/documents/{id}` returns latest version (or specific with `?version=X`)
- ✅ Re-segmentation can run on specific version

**Verification Steps**:
```bash
# 1. Create document
POST /api/upload → document_id=1
GET /api/documents/1 → text="original"

# 2. Edit document (should create version)
PATCH /api/documents/1 {"text": "edited"} → version_id=2
GET /api/documents/1 → text="edited"

# 3. Verify original preserved
GET /api/documents/1?version=1 → text="original"

# 4. Re-segment on specific version
POST /api/documents/1/segment?version=1 → segments based on original text
```

**Estimated Effort**: 4-6 hours

#### P0-3: Implement Fork-on-Edit for Auto Segments
**Goal**: Prevent in-place mutation of auto-generated segments to preserve re-segmentation determinism.

**Files to Touch**:
- `backend/src/ai_organizer/api/routes/segment.py` (modify PATCH endpoint)
- `src/pages/DocumentWorkspace.tsx` (update UI if needed)

**Acceptance Criteria**:
- ✅ Edit auto segment → new manual segment created, original unchanged
- ✅ Re-segmentation → original auto segments restored, manual segments preserved
- ✅ Edit manual segment → updates in-place (no fork needed)

**Verification Steps**:
```bash
# 1. Create auto segments
POST /api/documents/1/segment?mode=qa → segments created, isManual=false

# 2. Edit auto segment (should create manual clone)
PATCH /api/segments/1 {"content": "edited"} → new segment_id=2, isManual=true
GET /api/segments/1 → content="original", isManual=false
GET /api/segments/2 → content="edited", isManual=true

# 3. Re-segment (should restore original, preserve manual)
POST /api/documents/1/segment?mode=qa
GET /api/documents/1/segments → segment 1 restored, segment 2 preserved
```

**Estimated Effort**: 2-3 hours

---

### PHASE P1: Core Determinism + UX Stability

#### P1-1: Fix Folder Empty State Handling (Current Bug)
**Goal**: Ensure empty folders are automatically removed from backend and UI updates immediately.

**Files to Touch**:
- `backend/src/ai_organizer/api/routes/workspace.py` (modify `delete_folder_item` to auto-delete empty folders)
- `src/components/FolderView.tsx` (handle `folder_deleted` response)
- `src/pages/DocumentWorkspace.tsx` (ensure `onChunkUpdated` handles folder deletion)

**Acceptance Criteria**:
- ✅ Delete last chunk from folder → backend deletes folder
- ✅ "All folders" dropdown updates immediately (no refresh needed)
- ✅ Empty folders never appear in dropdown
- ✅ No race conditions or stale cache

**Verification Steps**:
```bash
# 1. Create folder with chunk
POST /api/workspace/folders {"name": "Test", "document_id": 1} → folder_id=1
POST /api/workspace/folder-items {"folder_id": 1, "chunk_id": "chunk1"} → item_id=1

# 2. Verify folder appears in list
GET /api/workspace/documents/1/folders → folder_id=1 in response

# 3. Delete last item (should delete folder)
DELETE /api/workspace/folder-items/1 → {"ok": true, "folder_deleted": true, "folder_id": 1}

# 4. Verify folder removed
GET /api/workspace/documents/1/folders → folder_id=1 NOT in response

# 5. UI test (manual)
# - Open DocumentWorkspace
# - Create folder, add chunk
# - Delete chunk from folder
# - "All folders" dropdown should update immediately (folder removed)
```

**Estimated Effort**: 2-3 hours

#### P1-2: Standardize Error Responses
**Goal**: All API errors return machine-readable `{code, message, details?}` structure.

**Files to Touch**:
- `backend/src/ai_organizer/api/routes/` (all route files - update HTTPException calls)
- `backend/src/ai_organizer/core/errors.py` (create new file with `APIError` class)
- `src/lib/errorHandler.ts` (update frontend error handling)

**Acceptance Criteria**:
- ✅ All errors return `{code, message, details?}` structure
- ✅ Frontend can programmatically handle errors by code
- ✅ OpenAPI schema reflects error structure

**Verification Steps**:
```bash
# Test various error scenarios
GET /api/documents/999 → 404 {"code": "not_found", "message": "Document not found", "details": {"document_id": 999}}
POST /api/upload (invalid file) → 422 {"code": "unsupported_file_type", "message": "...", "supported_extensions": [...]}
POST /api/auth/login (wrong password) → 401 {"code": "invalid_credentials", "message": "Invalid credentials"}
```

**Estimated Effort**: 3-4 hours

#### P1-3: Consolidate Refresh Token Mechanisms
**Goal**: Single refresh lock/queue mechanism, remove duplicate code.

**Files to Touch**:
- `src/api/apiClient.ts` (keep this implementation)
- `src/lib/api.ts` (remove duplicate refresh logic, use `apiClient.ts`)

**Acceptance Criteria**:
- ✅ Single refresh lock/queue mechanism
- ✅ Concurrent requests share same refresh promise
- ✅ No duplicate refresh calls

**Verification Steps**:
```bash
# Rapid concurrent API calls test
# Should see only one refresh call in network tab
# All requests should succeed
```

**Estimated Effort**: 1-2 hours

---

### PHASE P2: Research Backbone (Typing/Grading/Linking/Versioning)

#### P2-1: Segment Typing System
**Goal**: Allow users to classify segments as Definition, Claim, Evidence, etc.

**Files to Touch**:
- `backend/src/ai_organizer/models.py` (add `SegmentType` enum, `segment_type` field)
- `backend/alembic/versions/` (create migration)
- `backend/src/ai_organizer/api/routes/segment.py` (update endpoints)
- `src/components/workspace/` (add typing UI)

**Acceptance Criteria**:
- ✅ Segments can be typed (Definition, Claim, Evidence, etc.)
- ✅ Filter by type works
- ✅ UI allows quick typing (dropdown/keyboard shortcuts)

**Estimated Effort**: 4-6 hours

#### P2-2: Evidence Grading System
**Goal**: Allow users to grade evidence quality (E0–E4).

**Files to Touch**:
- `backend/src/ai_organizer/models.py` (add `EvidenceGrade` enum, `evidence_level` field)
- `backend/alembic/versions/` (create migration)
- `src/components/workspace/` (add grading UI)

**Acceptance Criteria**:
- ✅ Claim segments can be graded (E0–E4)
- ✅ Dashboard shows "evidence debt" (claims with low evidence)
- ✅ UI allows quick grading

**Estimated Effort**: 3-4 hours

#### P2-3: Linking Graph
**Goal**: Allow users to link segments (claim ↔ evidence, claim ↔ counterargument, etc.).

**Files to Touch**:
- `backend/src/ai_organizer/models.py` (add `Link` model)
- `backend/alembic/versions/` (create migration)
- `backend/src/ai_organizer/api/routes/` (add linking endpoints)
- `src/components/workspace/` (add linking UI)

**Acceptance Criteria**:
- ✅ Segments can be linked (supports, contradicts, depends_on, etc.)
- ✅ Users can traverse reasoning chains
- ✅ UI shows link graph visualization

**Estimated Effort**: 6-8 hours

---

### PHASE P3: Library/Folders + Recycle Bin + Retention

#### P3-1: Soft Delete + Recycle Bin
**Goal**: Implement soft delete with restore functionality.

**Files to Touch**:
- `backend/src/ai_organizer/models.py` (add `deleted_at` fields)
- `backend/alembic/versions/` (create migration)
- `backend/src/ai_organizer/api/routes/` (add restore endpoints)
- `src/components/RecycleBinDrawer.tsx` (enhance for all entity types)

**Estimated Effort**: 4-6 hours

#### P3-2: Retention Policy
**Goal**: Automatic cleanup of old deleted items.

**Files to Touch**:
- `backend/src/ai_organizer/core/tasks.py` (create background task)
- `backend/src/ai_organizer/core/config.py` (add retention_days setting)

**Estimated Effort**: 2-3 hours

---

### PHASE P4: Optional Intelligence Layer (Provider-Neutral)

#### P4-1: FTS Baseline Search
**Goal**: Implement SQLite FTS5 search over documents and segments.

**Files to Touch**:
- `backend/src/ai_organizer/api/routes/search.py` (enhance with FTS)
- `backend/alembic/versions/add_fts_tables.py` (verify/update migration)

**Estimated Effort**: 3-4 hours

#### P4-2: Provider-Agnostic LLM Interface (Future)
**Goal**: Design and implement LLM provider abstraction (ONLY if needed, after all P0-P3 complete).

**Files to Touch**:
- `backend/src/ai_organizer/ai/` (new directory)
- `backend/src/ai_organizer/ai/providers.py` (LLMProvider, EmbeddingProvider abstractions)
- `backend/src/ai_organizer/ai/adapters/` (OpenAI, Gemini, Llama adapters)

**Estimated Effort**: 8-12 hours (defer until P0-P3 complete)

---

## 5. ROOT CAUSE ANALYSIS: Folder UI Sync Issue

### Problem Statement
When a chunk is deleted from a folder, the "All folders" dropdown doesn't update immediately. Empty folders still appear in the dropdown, even though they have no items.

### Root Cause
1. **Backend doesn't auto-delete empty folders**: `delete_folder_item` in `workspace.py:320-339` only deletes the item, doesn't check if folder becomes empty.
2. **Frontend filtering race condition**: `loadFolderMap` calls `getFolder` for each folder, but cache invalidation timing causes stale data:
   - `delete_folder_item` clears cache
   - `onChunkUpdated` calls `loadFolderMap` with `skipCache=true`
   - But `getFolder` for empty folder might return cached empty items list
   - `filterFoldersWithItems` checks `folderMap` values, but if folder has no items, it won't be in `folderMap`, so it gets filtered out
   - However, if `getFolder` returns cached data showing items exist, folder stays in list

3. **Cache invalidation not comprehensive**: Cache clearing happens, but individual folder caches (`/api/workspace/folders/{id}`) might not be cleared before `loadFolderMap` calls `getFolder`.

4. **Timing issues**: 200ms delay might not be enough for backend to fully process deletion and invalidate caches.

### Recommended Fix
**Option A (Recommended)**: Backend auto-deletes empty folders
- **Pros**: Clean, consistent state, no frontend filtering needed
- **Cons**: Users might want to keep empty folders (but they can recreate)

**Option B**: Backend returns `itemCount` in folder list
- **Pros**: Frontend can filter efficiently without extra API calls
- **Cons**: Still requires frontend filtering logic

**Option C**: Frontend-only fix (current approach, but needs improvement)
- **Pros**: No backend changes
- **Cons**: Race conditions, cache invalidation issues, unreliable

### Implementation Plan (Option A)
1. **Backend**: Modify `delete_folder_item` to check if folder is empty after deletion, delete folder if empty
2. **Backend**: Return `folder_deleted` flag in response
3. **Frontend**: Update `onChunkUpdated` to handle `folder_deleted` response, refresh folder list immediately
4. **Frontend**: Remove complex filtering logic (backend handles it)

### Verification
```bash
# 1. Create folder with chunk
POST /api/workspace/folders {"name": "Test", "document_id": 1} → folder_id=1
POST /api/workspace/folder-items {"folder_id": 1, "chunk_id": "chunk1"} → item_id=1

# 2. Delete last item (should delete folder)
DELETE /api/workspace/folder-items/1 → {"ok": true, "folder_deleted": true, "folder_id": 1}

# 3. Verify folder removed from list
GET /api/workspace/documents/1/folders → folder_id=1 NOT in response
```

---

## 6. NEXT STEPS

1. **Immediate (Today)**: Begin implementing P0-1 (Remove Runtime Schema Creation) - small, safe change
2. **This Week**: Complete all P0 fixes (P0-1, P0-2, P0-3)
3. **Next Week**: Complete P1 fixes (P1-1, P1-2, P1-3)
4. **Next Month**: Begin P2 research backbone features

---

**Last Updated**: 2025-01-XX  
**Status**: Audit Complete, Ready for Implementation  
**Next Review**: After P0 fixes complete
