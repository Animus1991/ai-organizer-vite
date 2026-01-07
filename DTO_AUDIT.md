# DTO Standardization Audit

## Current State Analysis

### Backend DTOs (Pydantic BaseModel)

#### ✅ Already camelCase:
- `DocumentOut`: `sourceType`, `parseStatus`, `parseError`, `processedPath`
- `UploadOut`: `uploadId`, `documentId`, `sourceType`, `parseStatus`, `parseError`, `processedPath`
- `UploadListItem`: `uploadId`, `documentId`, `sizeBytes`, `contentType`, `parseStatus`, `parseError`
- `RegisterOut`: `userId`
- `MeOut`: `id`, `email`

#### ❌ Still snake_case:
- `TokenOut`: `access_token`, `refresh_token`, `token_type` (should be camelCase)

#### Segment DTOs (inline in responses):
- Uses: `orderIndex`, `isManual`, `createdAt` (camelCase) ✅

---

### Frontend DTOs (TypeScript types)

#### ✅ Already camelCase:
- `UploadItemDTO`: `uploadId`, `documentId`, `sizeBytes`, `contentType`, `parseStatus`, `parseError`
- `UploadResponseDTO`: `uploadId`, `documentId`, `sourceType`, `parseStatus`, `parseError`
- `SegmentDTO`: `orderIndex`, `isManual`, `createdAt`
- `SegmentationSummary`: `lastSegmentedAt`
- `SegmentsListMeta`: `lastRun`
- `SegmentPatchDTO`: `orderIndex`, `isManual`

#### ❌ Still snake_case:
- `DocumentDTO`: `source_type`, `parse_status`, `parse_error`, `processed_path` (should be camelCase)

---

## Inconsistencies Found

1. **TokenOut** (Backend): Uses `access_token`, `refresh_token`, `token_type` (snake_case)
   - Frontend expects: `accessToken`, `refreshToken`, `tokenType` (camelCase)
   - **Impact**: Token handling may have issues

2. **DocumentDTO** (Frontend): Uses `source_type`, `parse_status`, etc. (snake_case)
   - Backend returns: `sourceType`, `parseStatus`, etc. (camelCase)
   - **Impact**: Already fixed with mapping logic, but should be standardized

3. **Segment response fields**: Need to verify all fields match

---

## Standardization Plan

### Step 1: Backend - Fix TokenOut
- Change `access_token` → `accessToken`
- Change `refresh_token` → `refreshToken`
- Change `token_type` → `tokenType`

### Step 2: Frontend - Fix DocumentDTO
- Change `source_type` → `sourceType`
- Change `parse_status` → `parseStatus`
- Change `parse_error` → `parseError`
- Change `processed_path` → `processedPath`
- Remove mapping logic (no longer needed)

### Step 3: Verify Segment DTOs
- Ensure all segment fields match between backend and frontend

### Step 4: Update all API calls
- Remove any mapping/transformation logic
- Use DTOs directly

---

## Files to Modify

### Backend:
1. `backend/src/ai_organizer/api/routes/auth.py` - Fix `TokenOut`
2. `backend/src/ai_organizer/api/routes/segment.py` - Verify segment response fields

### Frontend:
1. `src/lib/api.ts` - Fix `DocumentDTO` type
2. `src/lib/api.ts` - Remove mapping logic in `getDocument()` and `patchDocument()`
3. All components using `DocumentDTO` - Update field names

---

## Verification Checklist

- [ ] Backend `TokenOut` uses camelCase
- [ ] Frontend `DocumentDTO` uses camelCase
- [ ] All segment fields match
- [ ] No mapping logic in frontend
- [ ] All API calls work without transformation
- [ ] TypeScript types match backend exactly

