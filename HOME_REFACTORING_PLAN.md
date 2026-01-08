# Home.tsx Refactoring Plan

## Current State
- **File**: `src/pages/Home.tsx`
- **Size**: ~1,852 lines
- **Status**: Large monolithic component

## Analysis

### Main Sections:
1. **Header** (~100 lines) - Logo, user info, logout button
2. **Upload Section** (~200 lines) - File upload, mode selection, segmentation controls
3. **Documents List** (~400 lines) - Uploads list with search/filter functionality
4. **Segments List** (~300 lines) - Segments display with filters
5. **Segment Viewer** (~300 lines) - Side panel for viewing selected segment
6. **State Management** (~150 lines) - All useState declarations
7. **Operations** (~200 lines) - Upload, segment, delete operations
8. **Utilities** (~50 lines) - Helper functions (preview120, formatBytes, statusBadge, etc.)

### Components Already Extracted:
- `SegmentationSummaryBar` ✅
- `FileUploadProgress` ✅
- `SearchModal` ✅
- `BatchOperations` ✅

## Refactoring Plan

### Phase 1: Extract Components (~800 lines)

#### 1.1 HomeHeader Component (~100 lines)
**Location**: `src/components/home/HomeHeader.tsx`
**Extract**:
- Logo and title section
- User info display
- Logout button

#### 1.2 UploadSection Component (~200 lines)
**Location**: `src/components/home/UploadSection.tsx`
**Extract**:
- File input
- Mode selection (QA/Paragraphs)
- Upload button with progress
- Segmentation controls
- Status messages

#### 1.3 DocumentsList Component (~400 lines)
**Location**: `src/components/home/DocumentsList.tsx`
**Extract**:
- Uploads table/list
- Search functionality
- Filter controls
- Batch operations
- Delete functionality

#### 1.4 SegmentsList Component (~300 lines)
**Location**: `src/components/home/SegmentsList.tsx`
**Extract**:
- Segments table/list
- Query filter
- Mode filter (all/qa/paragraphs)
- Click to open segment

#### 1.5 SegmentViewer Component (~300 lines)
**Location**: `src/components/home/SegmentViewer.tsx`
**Extract**:
- Side panel display
- Segment content viewer
- Copy buttons (with/without title)
- Export functionality

### Phase 2: Extract Hooks (~350 lines)

#### 2.1 useHomeState Hook (~150 lines)
**Location**: `src/hooks/home/useHomeState.ts`
**Extract**:
- All useState declarations
- All refs
- Computed values (useMemo)

#### 2.2 useHomeOperations Hook (~200 lines)
**Location**: `src/hooks/home/useHomeOperations.ts`
**Extract**:
- `fetchUploads()`
- `loadSegmentationSummary()`
- `doUpload()`
- `segmentDoc()`
- `loadSegments()`
- `deleteSelectedUpload()`
- `copyOpenSegment()`
- `exportOpenSegmentTxt()`

### Phase 3: Extract Utilities (~50 lines)

#### 3.1 Home Utilities (~50 lines)
**Location**: `src/lib/home/utils.ts`
**Extract**:
- `preview120()`
- `safeFileName()`
- `formatBytes()`
- `statusBadge()`
- `extractCount()`

## Estimated Reduction

### Phase 1 (Components): ~800 lines
- HomeHeader: ~100 lines
- UploadSection: ~200 lines
- DocumentsList: ~400 lines
- SegmentsList: ~300 lines
- SegmentViewer: ~300 lines

### Phase 2 (Hooks): ~350 lines
- useHomeState: ~150 lines
- useHomeOperations: ~200 lines

### Phase 3 (Utilities): ~50 lines
- Home utils: ~50 lines

### Total Reduction: ~1,200 lines
### Remaining: ~650 lines (for layout, modals, and orchestration)

## Benefits

1. **Maintainability**: Each component has a single responsibility
2. **Reusability**: Components can be reused in other pages
3. **Testability**: Easier to unit test individual components
4. **Readability**: Main Home.tsx focuses on orchestration
5. **Performance**: Better memoization opportunities

## Priority

**High Priority** (Start here):
- ✅ HomeHeader (simple, low risk)
- ✅ UploadSection (self-contained)
- ✅ useHomeOperations (critical for testability)

**Medium Priority**:
- ✅ DocumentsList (largest component, high impact)
- ✅ useHomeState (consolidates state)

**Lower Priority** (Optional):
- ⚠️ SegmentsList (if similar to DocumentWorkspace SegmentList)
- ⚠️ SegmentViewer (if self-contained)

## Implementation Order

1. **Start with HomeHeader** - Simple, low risk, quick win
2. **Extract Utilities** - Move helper functions to utils.ts
3. **Extract useHomeState** - Consolidate state management
4. **Extract useHomeOperations** - Move all operations to hook
5. **Extract UploadSection** - Self-contained component
6. **Extract DocumentsList** - Largest component, highest impact
7. **Extract SegmentsList & SegmentViewer** - If needed

## Notes

- Keep the same API/props structure to minimize breaking changes
- Test each extraction independently
- Maintain backward compatibility during refactoring
- Consider TypeScript types for all extracted components

