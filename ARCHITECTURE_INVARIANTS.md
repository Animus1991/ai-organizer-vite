# Architecture Invariants (Must Never Regress)

This document defines the **non-negotiable invariants** that must be preserved in all changes.

## 1. API Routing Conventions

**Invariant:** Single canonical prefix `/api/*` for all endpoints.

- ✅ All endpoints must be under `/api/*`
- ✅ Health check is `GET /api/health` (not `/health`)
- ✅ OpenAPI schema must reflect `/api/*` routes only
- ❌ No duplicate or root-level endpoints (except `/favicon.ico`)

**Verification:**
```bash
curl http://localhost:8000/api/health  # Should return 200 OK
curl http://localhost:8000/health      # Should return 404
```

## 2. Database Lifecycle

**Invariant:** Alembic migrations are the **only** source of truth for schema changes.

- ✅ No runtime `create_all()` calls that conflict with migrations
- ✅ Single consistent DB URL used by app + Alembic
- ✅ Fresh clone → `alembic upgrade head` → run must work repeatedly
- ❌ No manual schema changes outside Alembic

**Verification:**
```bash
# Fresh database test
rm backend/data/app.db
cd backend
alembic upgrade head
# Should complete without errors
python -m ai_organizer.main
# Should start without "table exists" errors
```

## 3. Provenance Safety

**Invariant:** Original text is immutable; edits create derived versions.

- ✅ `Document.text` is immutable after creation
- ✅ Editing creates derived version rows (not in-place mutation)
- ✅ Segments retain stable linkage via `start_char`/`end_char` offsets
- ✅ Auto-generated segments are NOT edited in-place; use fork-on-edit (manual clone)
- ❌ Never mutate source document text

**Verification:**
- Edit document → check new version row created
- Re-segment → original segments remain unchanged
- Edit auto segment → check manual clone created

## 4. Determinism & Reproducibility

**Invariant:** Same input → same segments → same ordering.

- ✅ Segmentation ordering uses `order_index` (deterministic)
- ✅ `order_by Segment.order_index.asc(), Segment.id.asc()` in all queries
- ✅ Refresh/reopen shows same results (no disappearing/reordered segments)
- ❌ No non-deterministic ordering (e.g., `ORDER BY RANDOM()`)

**Verification:**
```bash
# Upload same document twice, segment both, compare
# Segments should have same order_index, same content
```

## 5. Error Contract

**Invariant:** All errors must be machine-readable with `code` + `message` structure.

- ✅ Unsupported file types: `HTTP 422` with `{code: "unsupported_type", message, supported_extensions: [...]}`
- ✅ All `HTTPException` responses include structured `detail` (can be string for simple cases)
- ✅ Parsing errors: `parse_status: "failed"`, `parse_error: string`
- ❌ No silent failures or ambiguous error messages

**Verification:**
```bash
# Test unsupported file type
curl -X POST http://localhost:8000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.xyz"
# Should return 422 with structured error
```

## 6. Provider-Neutral AI (If Implemented)

**Invariant:** AI features must be optional, pluggable, and provider-agnostic.

- ✅ No vendor-specific hardcoded assumptions (no Google/Gemini exclusivity)
- ✅ AI layer uses abstraction (LLMProvider, EmbeddingProvider interfaces)
- ✅ Configuration-driven provider selection (env vars)
- ✅ System fully functions without AI features enabled
- ❌ No vendor branding in core logic

**Verification:**
- Disable AI features → all core flows work
- Switch provider via config → behavior changes only in AI layer

## 7. DTO Consistency

**Invariant:** All API responses use camelCase (frontend convention).

- ✅ Response DTOs use camelCase (e.g., `documentId`, `parseStatus`)
- ✅ Backend models use snake_case (e.g., `document_id`, `parse_status`)
- ✅ Conversion happens in route handlers (model → DTO)
- ❌ No mixing of naming conventions in same layer

**Verification:**
- Check OpenAPI schema → all response fields are camelCase
- Check database schema → all columns are snake_case

## 8. Auth Token Refresh Race Condition Prevention

**Invariant:** Token refresh must use lock/queue to prevent race conditions.

- ✅ Single refresh promise shared across concurrent requests
- ✅ Failed refresh triggers logout (clear tokens, redirect)
- ✅ No refresh loops (refresh endpoint excluded from retry)
- ❌ No simultaneous refresh calls for same user

**Verification:**
- Rapid concurrent API calls → only one refresh call made
- Refresh fails → tokens cleared, user logged out

## 9. Cache Invalidation

**Invariant:** Mutations must invalidate relevant caches.

- ✅ POST/PUT/DELETE/PATCH operations clear related caches
- ✅ Folder mutations clear folder-related caches (`/api/workspace/folders`, `/api/workspace/documents/{docId}/folders`)
- ✅ Folder item mutations clear folder caches (since folders contain items)
- ❌ No stale cached data after mutations

**Verification:**
- Create folder → cache cleared → fresh data on next GET
- Delete chunk from folder → folder cache cleared → empty folder filtered out

## 10. Folder State Synchronization

**Invariant:** Folder UI must reflect backend state immediately after mutations.

- ✅ Chunk deletion from folder → parent `folders` state updated
- ✅ Empty folders (no items) filtered out from "All folders" dropdown
- ✅ `loadFolderMap` includes both `segmentId` and `chunkId` mappings
- ✅ Cache cleared before reloading folder state
- ❌ No stale folder lists after chunk deletion

**Verification:**
- Delete chunk from folder → "All folders" dropdown updates immediately
- Delete last chunk from folder → folder disappears from dropdown
- Create folder → appears immediately in dropdown

---

## Regression Testing Checklist

Before each release, verify:

- [ ] All `/api/*` endpoints accessible, `/health` returns 404
- [ ] Fresh clone + `alembic upgrade head` + run works
- [ ] Upload same file twice → same segments, same ordering
- [ ] Edit document → version created, original unchanged
- [ ] Unsupported file type → 422 with structured error
- [ ] Rapid concurrent API calls → no refresh race condition
- [ ] Create folder → appears immediately in UI
- [ ] Delete chunk from folder → folder state updates immediately
- [ ] Empty folder → filtered out from dropdown
- [ ] All API responses use camelCase

---

**Last Updated:** 2025-01-XX
**Maintainer:** Architecture Review Team