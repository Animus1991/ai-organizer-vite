# AI Organizer - Architecture Audit & Roadmap
**Date**: 2025-01-06  
**Scope**: Full codebase audit (Frontend + Backend)  
**Goal**: Identify implemented/partial/missing features, bugs, and create prioritized roadmap

---

## EXECUTIVE SUMMARY

### Current State
- ✅ **Core functionality**: Upload, parse, segment, CRUD operations working
- ⚠️ **Stability issues**: Health endpoint duplication, runtime schema creation, DTO inconsistencies
- ❌ **Missing features**: Search, export, batch operations, LLM foundation

### Critical Issues (P0)
1. **Health endpoint duplication** - `/api/health` exists in both `main.py` and `routes/health.py`
2. **Runtime schema creation** - `create_db_and_tables()` called on startup conflicts with Alembic
3. **DTO naming inconsistency** - Backend uses camelCase (`parseStatus`), frontend expects snake_case (`parse_status`) - PARTIALLY FIXED
4. **Refresh token race conditions** - Multiple refresh mechanisms exist but not fully coordinated

### High Priority (P1)
1. **No search functionality** - FTS not implemented
2. **No export functionality** - JSON/CSV/MD export missing
3. **No batch operations** - Cannot delete/update multiple items
4. **Inconsistent loading states** - Some pages lack proper loading indicators

---

## CAPABILITY MATRIX

| Feature | Status | Implementation | Notes |
|---------|--------|----------------|-------|
| **PHASE A (P0 - BLOCKERS)** |
| Health endpoint (single) | ❌ **MISSING** | Duplicate: `/api/health` in `main.py` + `routes/health.py` | Must remove one |
| Upload 422 error format | ✅ **IMPLEMENTED** | `UploadError` with `code`, `message`, `supported_extensions` | Already correct |
| Auth refresh lock/queue | ⚠️ **PARTIAL** | Multiple implementations: `apiClient.ts`, `http.ts`, `api.ts` | Need consolidation |
| DTO standardization | ⚠️ **PARTIAL** | Backend camelCase, frontend mixed | Fixed `parseStatus` mapping, need full audit |
| Runtime schema creation | ❌ **VIOLATION** | `create_db_and_tables()` in `main.py` startup | Must remove, use Alembic only |
| Segmentation determinism | ✅ **IMPLEMENTED** | `order_by(Segment.order_index.asc(), Segment.id.asc())` | Stable ordering |
| **PHASE B (P1 - CORE UX)** |
| Document viewer page | ✅ **IMPLEMENTED** | `DocumentViewer.tsx` exists | Needs polish |
| Loading states | ⚠️ **PARTIAL** | Some pages have, some don't | Inconsistent |
| Form validation | ⚠️ **PARTIAL** | Basic validation exists | Needs enhancement |
| Upload progress bar | ❌ **MISSING** | No progress indicator | Should add |
| Full-text search (FTS) | ❌ **MISSING** | No search implementation | SQLite FTS5 available |
| Segment search/filter | ❌ **MISSING** | Only client-side filtering | Need backend search |
| Export (JSON/CSV/MD) | ❌ **MISSING** | No export endpoints | Should add |
| Batch operations | ❌ **MISSING** | No bulk delete/update | Should add |
| **PHASE C (P2 - LLM FOUNDATION)** |
| Provider-agnostic LLM interface | ❌ **MISSING** | No LLM abstraction | Design needed |
| Async job pipeline | ❌ **MISSING** | No background jobs | Need Celery/Redis |
| Embeddings indexing | ❌ **MISSING** | No vector store | Need integration |
| Vector store integration | ❌ **MISSING** | No embeddings DB | Need Chroma/Pinecone/etc |
| Hybrid retrieval (FTS + embeddings) | ❌ **MISSING** | No retrieval system | Design needed |
| Reranking | ❌ **MISSING** | No reranking logic | Future feature |
| Evaluation harness | ❌ **MISSING** | No golden queries | Need test suite |
| **PHASE D (P3 - LLM FEATURES)** |
| Auto-tagging | ❌ **MISSING** | No AI features | Future |
| Summaries | ❌ **MISSING** | No AI features | Future |
| Semantic search UI | ❌ **MISSING** | No AI features | Future |
| RAG Q/A with citations | ❌ **MISSING** | No AI features | Future |

---

## DETAILED FINDINGS

### 1. Health Endpoint Duplication (P0)

**Location**: 
- `backend/src/ai_organizer/main.py:96` - `@app.get("/api/health")`
- `backend/src/ai_organizer/api/routes/health.py:5` - `@router.get("/health")`

**Issue**: Both endpoints exist, causing confusion and potential conflicts.

**Fix**: Remove from `main.py`, keep only in `routes/health.py` (already included via router).

**Risk**: Low - cosmetic issue, but violates single source of truth.

---

### 2. Runtime Schema Creation (P0)

**Location**: `backend/src/ai_organizer/main.py:77` - `create_db_and_tables()`

**Issue**: Calls `SQLModel.metadata.create_all(engine)` on startup, which can conflict with Alembic migrations.

**Fix**: Remove `create_db_and_tables()` from startup. Alembic migrations are the only source of truth.

**Risk**: High - Can cause schema drift if migrations and runtime creation differ.

**Code**:
```python
# REMOVE THIS:
@app.on_event("startup")
def on_startup() -> None:
    # ...
    create_db_and_tables()  # ❌ REMOVE
```

**Migration**: Ensure all tables exist via Alembic before deployment.

---

### 3. DTO Naming Inconsistency (P0 - PARTIALLY FIXED)

**Status**: ✅ **FIXED** for `parseStatus` mapping, but needs full audit.

**Backend** (camelCase):
- `DocumentOut.parseStatus`
- `DocumentOut.sourceType`
- `DocumentOut.processedPath`

**Frontend** (snake_case expected):
- `DocumentDTO.parse_status`
- `DocumentDTO.source_type`
- `DocumentDTO.processed_path`

**Fix Applied**: `getDocument()` and `patchDocument()` now handle both formats:
```typescript
parse_status: (data as any).parseStatus ?? (data as any).parse_status ?? undefined,
```

**Remaining Work**: Audit all DTOs for consistency. Choose one convention (recommend camelCase to match backend).

---

### 4. Auth Refresh Lock/Queue (P0 - PARTIAL)

**Status**: Multiple implementations exist but not fully coordinated.

**Implementations**:
1. `src/api/apiClient.ts` - Uses `refreshPromise` lock ✅
2. `src/api/http.ts` - Uses `isRefreshing` + `refreshWaiters` queue ✅
3. `src/lib/api.ts` - Uses `isRefreshing` + `refreshPromise` ✅

**Issue**: Three different refresh mechanisms can conflict.

**Fix**: Consolidate to single implementation. Recommend keeping `apiClient.ts` as primary (most complete).

**Risk**: Medium - Can cause token refresh storms if multiple requests trigger simultaneously.

---

### 5. Segmentation Determinism (P0 - VERIFIED)

**Status**: ✅ **IMPLEMENTED CORRECTLY**

**Backend**: `backend/src/ai_organizer/api/routes/segment.py:291-293`
```python
if mode:
    stmt = stmt.order_by(Segment.order_index.asc(), Segment.id.asc())
else:
    stmt = stmt.order_by(Segment.mode.asc(), Segment.order_index.asc(), Segment.id.asc())
```

**Result**: Stable ordering guaranteed by `order_index` + `id` (tiebreaker).

---

### 6. Full-Text Search (P1 - MISSING)

**Status**: ❌ **NOT IMPLEMENTED**

**Requirements**:
- SQLite FTS5 available
- Need FTS table for documents
- Need FTS table for segments
- Need search endpoint: `GET /api/documents?q=query`
- Need segment search: `GET /api/documents/{id}/segments?q=query`

**Implementation Plan**:
1. Create Alembic migration for FTS tables
2. Add FTS index on document upload/update
3. Add FTS index on segment creation/update
4. Implement search endpoints
5. Add frontend search UI

---

### 7. Export Functionality (P1 - MISSING)

**Status**: ❌ **NOT IMPLEMENTED**

**Requirements**:
- Export document as JSON/CSV/MD
- Export segments as JSON/CSV/MD
- Batch export multiple documents

**Implementation Plan**:
1. Add endpoint: `GET /api/documents/{id}/export?format=json|csv|md`
2. Add endpoint: `GET /api/documents/{id}/segments/export?format=json|csv|md`
3. Add frontend export buttons
4. Implement formatters for each format

---

### 8. Batch Operations (P1 - MISSING)

**Status**: ❌ **NOT IMPLEMENTED**

**Requirements**:
- Bulk delete segments
- Bulk update segments
- Bulk delete documents

**Implementation Plan**:
1. Add endpoint: `DELETE /api/documents/{id}/segments/batch` with body `{ids: [1,2,3]}`
2. Add endpoint: `PATCH /api/documents/{id}/segments/batch` with body `{updates: [...]}`
3. Add frontend batch selection UI

---

## BUG RISKS & INCOMPATIBILITIES

### P0 (Critical - Must Fix)
1. **Runtime schema creation** - Can cause schema drift
2. **Health endpoint duplication** - Confusion, potential conflicts
3. **DTO naming inconsistency** - Partial fix applied, needs full audit

### P1 (High - Should Fix)
1. **Multiple refresh mechanisms** - Can cause race conditions
2. **Inconsistent loading states** - Poor UX
3. **No error boundaries** - Frontend crashes possible

### P2 (Medium - Nice to Have)
1. **No request deduplication** - Can cause duplicate API calls
2. **No caching strategy** - Repeated fetches
3. **No pagination** - Large result sets can cause performance issues

---

## PRIORITIZED ROADMAP

### PHASE A (P0 - BLOCKERS) - **MUST COMPLETE FIRST**

#### A1: Remove Health Duplication
- **Task**: Remove `/api/health` from `main.py`
- **Files**: `backend/src/ai_organizer/main.py:96-98`
- **Acceptance**: Only one health endpoint exists at `/api/health`
- **Verification**: `curl http://localhost:8000/api/health` returns 200

#### A2: Remove Runtime Schema Creation
- **Task**: Remove `create_db_and_tables()` from startup
- **Files**: `backend/src/ai_organizer/main.py:77`, `backend/src/ai_organizer/core/db.py:73-90`
- **Acceptance**: No `create_all` calls in runtime code
- **Verification**: Run Alembic migrations, verify tables exist, restart server (no errors)

#### A3: Consolidate Auth Refresh
- **Task**: Choose single refresh implementation, remove others
- **Files**: `src/api/apiClient.ts`, `src/api/http.ts`, `src/lib/api.ts`
- **Acceptance**: Single refresh mechanism, no race conditions
- **Verification**: Trigger multiple 401s simultaneously, verify only one refresh call

#### A4: Standardize DTOs
- **Task**: Audit all DTOs, choose convention (camelCase), update frontend
- **Files**: All route files, `src/lib/api.ts`
- **Acceptance**: Backend and frontend DTOs match exactly
- **Verification**: All API calls work without mapping logic

#### A5: Verify Segmentation Determinism
- **Task**: Add test for stable ordering
- **Files**: Test file (create new)
- **Acceptance**: Same document segmented twice produces identical order
- **Verification**: Run segmentation twice, compare segment lists (should match)

---

### PHASE B (P1 - CORE UX) - **AFTER PHASE A**

#### B1: Document Viewer Enhancement
- **Task**: Polish `DocumentViewer.tsx`, add loading states
- **Files**: `src/pages/DocumentViewer.tsx`
- **Acceptance**: Smooth loading, error handling, responsive design

#### B2: Upload Progress Bar
- **Task**: Add progress indicator for file uploads
- **Files**: `src/pages/Home.tsx`, `src/lib/api.ts`
- **Acceptance**: Progress bar shows upload percentage

#### B3: Full-Text Search (FTS)
- **Task**: Implement SQLite FTS5 for documents and segments
- **Files**: New migration, `backend/src/ai_organizer/api/routes/search.py` (new)
- **Acceptance**: Search returns relevant results, fast response

#### B4: Segment Search/Filter
- **Task**: Add backend search for segments
- **Files**: `backend/src/ai_organizer/api/routes/segment.py`
- **Acceptance**: Can search segments by content, filter by mode

#### B5: Export Functionality
- **Task**: Add JSON/CSV/MD export endpoints
- **Files**: New route file, frontend components
- **Acceptance**: Can export documents and segments in all formats

#### B6: Batch Operations
- **Task**: Add bulk delete/update endpoints
- **Files**: `backend/src/ai_organizer/api/routes/segment.py`, frontend
- **Acceptance**: Can select and operate on multiple items

---

### PHASE C (P2 - LLM FOUNDATION) - **AFTER PHASE B**

#### C1: Provider-Agnostic LLM Interface
- **Task**: Design and implement LLM abstraction layer
- **Files**: `backend/src/ai_organizer/llm/` (new directory)
- **Acceptance**: Can switch LLM providers without code changes

#### C2: Async Job Pipeline
- **Task**: Add Celery/Redis for background jobs
- **Files**: New job queue infrastructure
- **Acceptance**: Long-running AI tasks run asynchronously

#### C3: Embeddings Indexing
- **Task**: Generate and store embeddings for documents/segments
- **Files**: New embeddings service
- **Acceptance**: Embeddings generated on document upload/update

#### C4: Vector Store Integration
- **Task**: Integrate Chroma/Pinecone/etc
- **Files**: New vector store service
- **Acceptance**: Embeddings stored and queryable

#### C5: Hybrid Retrieval
- **Task**: Combine FTS + embeddings search
- **Files**: New retrieval service
- **Acceptance**: Search uses both methods, returns ranked results

#### C6: Evaluation Harness
- **Task**: Create golden queries test suite
- **Files**: Test suite
- **Acceptance**: Can detect regressions in search quality

---

### PHASE D (P3 - LLM FEATURES) - **AFTER PHASE C**

#### D1: Auto-Tagging
- **Task**: Generate tags for documents/segments
- **Files**: New AI service
- **Acceptance**: Tags generated automatically on upload

#### D2: Summaries
- **Task**: Generate document/segment summaries
- **Files**: New AI service
- **Acceptance**: Summaries available in UI

#### D3: Semantic Search UI
- **Task**: Add semantic search interface
- **Files**: Frontend components
- **Acceptance**: Users can search semantically

#### D4: RAG Q/A with Citations
- **Task**: Implement Q/A system with source citations
- **Files**: New RAG service, frontend
- **Acceptance**: Can ask questions, get answers with segment citations

---

## ENHANCED RECOMMENDATIONS

### 1. Request Deduplication
**Why**: Prevent duplicate API calls when user clicks rapidly.
**How**: Add request deduplication layer in `src/lib/api.ts`.
**Priority**: P1

### 2. Response Caching
**Why**: Reduce server load, improve UX.
**How**: Add cache layer for GET requests (documents, segments list).
**Priority**: P1

### 3. Pagination
**Why**: Large result sets can cause performance issues.
**How**: Add pagination to list endpoints (`?page=1&limit=50`).
**Priority**: P1

### 4. Error Boundaries
**Why**: Prevent full app crashes on component errors.
**How**: Add React error boundaries to key pages.
**Priority**: P1

### 5. API Rate Limiting
**Why**: Prevent abuse, ensure fair usage.
**How**: Add rate limiting middleware to FastAPI.
**Priority**: P2

### 6. Request Logging
**Why**: Debug issues, monitor usage.
**How**: Add structured logging for all API requests.
**Priority**: P2

### 7. Health Check Enhancement
**Why**: Better monitoring, detect issues early.
**How**: Add database connectivity check, disk space check.
**Priority**: P2

### 8. API Versioning
**Why**: Allow breaking changes without breaking clients.
**How**: Add `/api/v1/` prefix, version in OpenAPI.
**Priority**: P2

---

## ACCEPTANCE CRITERIA FOR PHASE A

### A1: Health Endpoint
- ✅ Only `/api/health` exists (via router)
- ✅ Returns `{"ok": true}`
- ✅ No duplicate endpoints

### A2: No Runtime Schema Creation
- ✅ `create_db_and_tables()` removed from startup
- ✅ All tables created via Alembic only
- ✅ Server starts without `create_all` calls

### A3: Single Refresh Mechanism
- ✅ Only one refresh implementation active
- ✅ Concurrent 401s trigger single refresh
- ✅ No race conditions

### A4: DTO Standardization
- ✅ All DTOs use camelCase (or snake_case consistently)
- ✅ Frontend types match backend exactly
- ✅ No mapping logic needed

### A5: Segmentation Determinism
- ✅ Same document segmented twice = identical order
- ✅ Ordering stable across server restarts
- ✅ Test passes

---

## MANUAL VERIFICATION STEPS

### After Phase A Completion:

1. **Health Endpoint**:
   ```bash
   curl http://localhost:8000/api/health
   # Should return: {"ok": true}
   # Should NOT have duplicate endpoints
   ```

2. **No Runtime Schema Creation**:
   ```bash
   # Check startup logs - should NOT see "create_all" calls
   # Verify tables exist via Alembic only
   ```

3. **Refresh Lock**:
   ```bash
   # Open browser console
   # Trigger multiple 401s simultaneously
   # Verify only one refresh call in network tab
   ```

4. **DTO Consistency**:
   ```bash
   # Check all API responses match frontend types
   # No TypeScript errors in IDE
   ```

5. **Segmentation Determinism**:
   ```bash
   # Upload document
   # Segment it twice
   # Compare segment lists - should be identical
   ```

---

## NEXT STEPS

1. **Review this audit** with team
2. **Prioritize Phase A items** (all P0 must be done first)
3. **Create GitHub issues** for each task
4. **Implement Phase A** in small, verifiable patches
5. **Verify acceptance criteria** after each patch
6. **Proceed to Phase B** only after Phase A is complete

---

## NOTES

- **Stability First**: Never start LLM features until P0 + P1 are complete
- **Small Patches**: Each change should be small and verifiable
- **Test Coverage**: Add tests for critical paths (auth, segmentation)
- **Documentation**: Update API docs as changes are made
- **Backward Compatibility**: Maintain API compatibility during Phase A fixes

---

**End of Audit Report**

