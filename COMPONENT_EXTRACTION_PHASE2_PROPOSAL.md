# Component Extraction Phase 2 Proposal

## Current State After Phase 1
- **DocumentWorkspace.tsx**: 2,946 lines
- **Components Created**: 2 (WorkspaceToolbar, WorkspaceFilters)
- **Lines Reduced**: 685 lines

## Phase 2 Opportunities

### High-Value, Medium-Risk Extractions

#### 1. **Modal Components** (Recommended Priority)

##### 1.1 `DocumentNotesModal.tsx` (~130 lines)
**Location**: Lines 1570-1704
**Extract**:
- Document Notes modal UI
- Rich text editor integration
- Save/reset functionality
- Help section

**Benefits**:
- Reduces main file by ~130 lines
- Isolated modal logic
- Reusable component
- **Risk**: Low (self-contained)

##### 1.2 `SmartNotesModal.tsx` (~400 lines)
**Location**: Lines 1706-2115
**Extract**:
- Smart Notes modal UI
- Rich text editor
- Tags & category management
- Notes list sidebar
- Search & filter functionality

**Benefits**:
- Reduces main file by ~400 lines
- Complex but isolated logic
- **Risk**: Medium (more state dependencies)

##### 1.3 `ManualChunkModal.tsx` (~340 lines)
**Location**: Lines 2116-2456
**Extract**:
- Manual chunk creation modal
- Document text selection
- Preview functionality
- Save logic

**Benefits**:
- Reduces main file by ~340 lines
- Clear separation of concerns
- **Risk**: Medium (selection logic)

##### 1.4 `ChunkEditModal.tsx` (~580 lines)
**Location**: Lines 2457-3040
**Extract**:
- Chunk editing modal
- Rich text editor
- Title/content editing
- Folder assignment
- Fullscreen mode
- Save/delete logic

**Benefits**:
- Reduces main file by ~580 lines
- Largest modal component
- **Risk**: Medium (complex state)

##### 1.5 `DocumentEditModal.tsx` (~60 lines)
**Location**: Lines 3040-3100
**Extract**:
- Document editing modal
- Rich text editor
- Save functionality

**Benefits**:
- Reduces main file by ~60 lines
- Simple, self-contained
- **Risk**: Low

**Total Modal Reduction**: ~1,510 lines

#### 2. **Segment List Component** (High Value)

##### 2.1 `SegmentList.tsx` (~500-600 lines)
**Location**: Lines ~1300-1800 (segment list rendering)
**Extract**:
- Segment list rendering
- Segment item component
- Click/double-click handlers
- Folder assignment UI
- Delete confirmation UI
- Preview functionality

**Benefits**:
- Reduces main file by ~500-600 lines
- Reusable list component
- Better performance (memoization)
- **Risk**: Medium-High (core functionality)

## Recommended Phase 2 Plan

### Option A: Extract All Modals (Lower Risk, High Value)
**Priority**: Extract modals first (they're more self-contained)

1. ✅ `DocumentEditModal.tsx` (60 lines) - **Easiest, start here**
2. ✅ `DocumentNotesModal.tsx` (130 lines)
3. ✅ `ManualChunkModal.tsx` (340 lines)
4. ✅ `ChunkEditModal.tsx` (580 lines)
5. ✅ `SmartNotesModal.tsx` (400 lines)

**Total Reduction**: ~1,510 lines
**Estimated Time**: 4-6 hours
**Risk**: Medium (modals are self-contained)

### Option B: Extract Segment List (Higher Value, Higher Risk)
**Priority**: Extract segment list (largest single section)

1. ✅ `SegmentList.tsx` (~500-600 lines)

**Total Reduction**: ~500-600 lines
**Estimated Time**: 3-4 hours
**Risk**: Medium-High (core functionality)

### Option C: Hybrid Approach (Recommended)
**Priority**: Start with easier modals, then segment list

1. ✅ `DocumentEditModal.tsx` (60 lines) - Quick win
2. ✅ `DocumentNotesModal.tsx` (130 lines) - Quick win
3. ✅ `ManualChunkModal.tsx` (340 lines)
4. ✅ `SegmentList.tsx` (500-600 lines) - High value
5. ✅ `ChunkEditModal.tsx` (580 lines)
6. ✅ `SmartNotesModal.tsx` (400 lines)

**Total Reduction**: ~2,000-2,100 lines
**Estimated Time**: 8-12 hours
**Risk**: Managed (incremental approach)

## File Structure After Phase 2

```
src/
├── components/
│   └── workspace/
│       ├── index.ts
│       ├── WorkspaceToolbar.tsx
│       ├── WorkspaceFilters.tsx
│       ├── DocumentNotesModal.tsx      # NEW
│       ├── SmartNotesModal.tsx         # NEW
│       ├── ManualChunkModal.tsx        # NEW
│       ├── ChunkEditModal.tsx          # NEW
│       ├── DocumentEditModal.tsx       # NEW
│       └── SegmentList.tsx             # NEW
└── pages/
    └── DocumentWorkspace.tsx           # Reduced to ~800-900 lines
```

## Benefits of Phase 2

1. **Massive Size Reduction**: ~2,000 lines removed
2. **Better Organization**: Each modal is self-contained
3. **Improved Testability**: Modals can be tested independently
4. **Performance**: Better memoization opportunities
5. **Maintainability**: Easier to locate and fix issues

## Recommendation

**Start with Option C (Hybrid Approach)**:
1. Begin with `DocumentEditModal.tsx` (quick win, 60 lines)
2. Then `DocumentNotesModal.tsx` (130 lines)
3. Then `ManualChunkModal.tsx` (340 lines)
4. Then `SegmentList.tsx` (500-600 lines) - highest value
5. Finally the complex modals

This approach:
- ✅ Provides quick wins early
- ✅ Builds confidence
- ✅ Manages risk incrementally
- ✅ Maximizes value

## Next Steps

Would you like to proceed with Phase 2? I recommend starting with `DocumentEditModal.tsx` as it's the smallest and easiest, providing a quick win before tackling larger components.

