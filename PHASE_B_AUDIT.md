# Phase B (P1 - Core Product UX) - Complete Audit

## Current State Analysis

### ✅ B1: Document Viewer Page
**Status**: ✅ **IMPLEMENTED** (Partial)

**Current Implementation**:
- Route exists: `/documents/:documentId/view`
- Component: `src/pages/DocumentViewer.tsx`
- Features:
  - ✅ Loading state with spinner
  - ✅ Error handling
  - ✅ Document display with metadata
  - ✅ Back navigation
  - ✅ Link to workspace

**Missing/Needs Enhancement**:
- ⚠️ No search within document
- ⚠️ No export functionality
- ⚠️ No print functionality
- ⚠️ No text selection/copy enhancements
- ⚠️ No syntax highlighting for code
- ⚠️ No word count/statistics

**Action Required**: Enhance existing viewer with missing features

---

### ⚠️ B2: Consistent Loading States
**Status**: ⚠️ **PARTIAL**

**Current Implementation**:
- ✅ `useLoading` hook exists (`src/hooks/useLoading.ts`)
- ✅ Used in `Home.tsx` for uploads, delete, upload operations
- ✅ `DocumentViewer.tsx` has loading state
- ✅ `DocumentWorkspace.tsx` has status messages

**Missing/Inconsistent**:
- ⚠️ Not all pages use `useLoading` consistently
- ⚠️ Some pages use local `loading` state instead of hook
- ⚠️ No global loading indicator
- ⚠️ No skeleton loaders for better UX
- ⚠️ Loading states not always visible/clear

**Action Required**: Standardize loading states across all pages

---

### ❌ B3: Form Validation
**Status**: ❌ **MISSING**

**Current Implementation**:
- ⚠️ Basic error handling in forms
- ⚠️ No client-side validation
- ⚠️ No validation feedback UI
- ⚠️ No field-level error messages

**Missing**:
- ❌ Email format validation
- ❌ Password strength validation
- ❌ File type validation (client-side)
- ❌ File size validation (client-side)
- ❌ Required field indicators
- ❌ Real-time validation feedback

**Action Required**: Implement comprehensive form validation

---

### ❌ B4: Upload Progress Bar
**Status**: ❌ **MISSING**

**Current Implementation**:
- ⚠️ Upload uses `fetch` with `FormData`
- ⚠️ No progress tracking
- ⚠️ Only status messages ("Uploading...", "Uploaded")

**Missing**:
- ❌ No `XMLHttpRequest` or `fetch` with progress
- ❌ No progress percentage
- ❌ No upload speed indicator
- ❌ No time remaining estimate
- ❌ No cancel upload functionality

**Action Required**: Implement upload progress tracking

---

### ❌ B5: Full-Text Search (SQLite FTS)
**Status**: ❌ **MISSING**

**Current Implementation**:
- ⚠️ No backend search endpoint
- ⚠️ No FTS index on documents/segments
- ⚠️ Frontend has basic query filter (client-side only)

**Missing**:
- ❌ No SQLite FTS5 setup
- ❌ No search API endpoint
- ❌ No search UI
- ❌ No search results highlighting
- ❌ No search history

**Action Required**: Implement backend FTS + frontend search UI

---

### ⚠️ B6: Segment Search/Filter
**Status**: ⚠️ **PARTIAL**

**Current Implementation**:
- ✅ Basic client-side filter in `Home.tsx` and `DocumentWorkspace.tsx`
- ✅ Mode filter (qa/paragraphs/all)
- ✅ Query string filter (searches in title/content)

**Missing**:
- ⚠️ No backend search integration
- ⚠️ No advanced filters (date, source, etc.)
- ⚠️ No saved filters
- ⚠️ No filter presets

**Action Required**: Enhance with backend search integration

---

### ❌ B7: Export Functionality
**Status**: ❌ **MISSING**

**Current Implementation**:
- ⚠️ No export endpoints
- ⚠️ No export UI
- ⚠️ No export formats

**Missing**:
- ❌ No JSON export
- ❌ No CSV export
- ❌ No Markdown export
- ❌ No batch export
- ❌ No export templates

**Action Required**: Implement export functionality

---

### ❌ B8: Batch Operations
**Status**: ❌ **MISSING**

**Current Implementation**:
- ⚠️ No batch selection UI
- ⚠️ No batch endpoints
- ⚠️ Individual operations only

**Missing**:
- ❌ No multi-select for segments
- ❌ No batch delete
- ❌ No batch export
- ❌ No batch folder assignment
- ❌ No batch tagging

**Action Required**: Implement batch operations

---

## Priority Order (Based on User Impact)

### High Priority (Core UX)
1. **B2: Consistent Loading States** - Improves perceived performance
2. **B3: Form Validation** - Prevents errors, improves UX
3. **B4: Upload Progress Bar** - Critical for large files
4. **B6: Enhanced Segment Search/Filter** - Already partially done, easy to enhance

### Medium Priority (Feature Completeness)
5. **B1: Enhance Document Viewer** - Add missing features
6. **B5: Full-Text Search** - Powerful feature, requires backend work
7. **B7: Export Functionality** - Useful but not critical

### Lower Priority (Nice to Have)
8. **B8: Batch Operations** - Useful but can be added later

---

## Implementation Strategy

### Phase B.1: Quick Wins (High Impact, Low Effort)
- B2: Standardize loading states
- B3: Add form validation
- B4: Add upload progress
- B6: Enhance segment search

### Phase B.2: Core Features (Medium Effort)
- B1: Enhance document viewer
- B5: Implement FTS search

### Phase B.3: Advanced Features (Higher Effort)
- B7: Export functionality
- B8: Batch operations

---

## Files to Modify/Create

### Backend
- `backend/src/ai_organizer/api/routes/search.py` (NEW) - Search endpoints
- `backend/src/ai_organizer/api/routes/export.py` (NEW) - Export endpoints
- `backend/src/ai_organizer/core/db.py` - Add FTS tables/indexes
- `backend/alembic/versions/` - Migration for FTS

### Frontend
- `src/components/LoadingSpinner.tsx` (ENHANCE) - Standardized loading
- `src/components/ProgressBar.tsx` (NEW) - Upload progress
- `src/components/FormValidation.tsx` (NEW) - Validation utilities
- `src/components/SearchBar.tsx` (NEW) - Search UI
- `src/components/ExportDialog.tsx` (NEW) - Export UI
- `src/components/BatchSelector.tsx` (NEW) - Batch operations
- `src/pages/DocumentViewer.tsx` (ENHANCE) - Add features
- `src/pages/Home.tsx` (ENHANCE) - Add validation, progress
- `src/pages/DocumentWorkspace.tsx` (ENHANCE) - Add search, export

---

## Acceptance Criteria

### B1: Document Viewer
- [ ] Document loads with loading indicator
- [ ] Error states handled gracefully
- [ ] Search within document works
- [ ] Export button works
- [ ] Print functionality works

### B2: Loading States
- [ ] All pages use consistent loading indicators
- [ ] Loading states are visible and clear
- [ ] Skeleton loaders for better UX
- [ ] No flickering between states

### B3: Form Validation
- [ ] Email format validated
- [ ] Password strength validated
- [ ] File type validated client-side
- [ ] File size validated client-side
- [ ] Error messages are clear and helpful

### B4: Upload Progress
- [ ] Progress bar shows percentage
- [ ] Upload speed displayed
- [ ] Time remaining estimated
- [ ] Cancel upload works

### B5: Full-Text Search
- [ ] FTS index created on documents
- [ ] FTS index created on segments
- [ ] Search endpoint returns results
- [ ] Search UI with results highlighting
- [ ] Search is fast (< 100ms for typical queries)

### B6: Segment Search/Filter
- [ ] Backend search integrated
- [ ] Advanced filters available
- [ ] Filter presets work
- [ ] Search results highlighted

### B7: Export
- [ ] JSON export works
- [ ] CSV export works
- [ ] Markdown export works
- [ ] Batch export works

### B8: Batch Operations
- [ ] Multi-select UI works
- [ ] Batch delete works
- [ ] Batch export works
- [ ] Batch folder assignment works

---

## Next Steps

1. Start with B2 (Loading States) - Quick win, high impact
2. Then B3 (Form Validation) - Prevents errors
3. Then B4 (Upload Progress) - Critical for UX
4. Then B6 (Enhanced Search) - Builds on existing
5. Then B1 (Document Viewer) - Enhance existing
6. Then B5 (FTS) - Requires backend work
7. Then B7 (Export) - Nice to have
8. Finally B8 (Batch Ops) - Advanced feature

