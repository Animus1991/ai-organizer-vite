# Component Extraction Plan for DocumentWorkspace.tsx

## Current State
- **File Size**: 3,629 lines
- **Complexity**: Very High
- **Maintainability**: Low
- **Refactoring Risk**: Medium-High

## Recommended Component Extraction Strategy

### Phase 1: Extract Toolbar Components (Low Risk, High Value)

#### 1.1 `WorkspaceToolbar.tsx`
**Extract:**
- Mode selector
- All action buttons (List segments, Segment now, Delete, Manual chunk, Export)
- Document Notes & Smart Notes buttons

**Benefits:**
- Reduces main file by ~200-300 lines
- Reusable toolbar component
- Easier to test and maintain

#### 1.2 `WorkspaceFilters.tsx`
**Extract:**
- All filter controls (All chunks, All folders, Folders, Document Structure)
- Search input
- Clear button
- Filter presets dropdown
- Advanced filters panel

**Benefits:**
- Reduces main file by ~150-200 lines
- Isolated filter logic
- Better organization

### Phase 2: Extract Modal/Drawer Components (Medium Risk)

#### 2.1 `ManualChunkModal.tsx`
**Extract:**
- Manual chunk creation modal
- Selection logic
- Preview functionality

**Benefits:**
- Reduces main file by ~300-400 lines
- Isolated modal logic
- Reusable component

#### 2.2 `ChunkEditModal.tsx`
**Extract:**
- Chunk editing modal
- Edit form
- Save/delete logic

**Benefits:**
- Reduces main file by ~400-500 lines
- Clear separation of concerns

#### 2.3 `DocumentEditModal.tsx`
**Extract:**
- Document editing modal
- Rich text editor integration

**Benefits:**
- Reduces main file by ~200-300 lines

### Phase 3: Extract List/View Components (Medium-High Risk)

#### 3.1 `SegmentList.tsx`
**Extract:**
- Segment list rendering
- Segment item component
- Click/double-click handlers
- Folder assignment UI

**Benefits:**
- Reduces main file by ~500-600 lines
- Reusable list component
- Better performance (memoization)

#### 3.2 `SegmentViewer.tsx`
**Extract:**
- Selected segment display
- Segment content rendering
- Edit/delete actions

**Benefits:**
- Reduces main file by ~300-400 lines
- Clear component boundaries

### Phase 4: Extract Custom Hooks (Low Risk, High Value)

#### 4.1 `useWorkspaceState.ts`
**Extract:**
- All useState declarations
- State management logic
- Initial state setup

**Benefits:**
- Cleaner component
- Easier to test
- Better organization

#### 4.2 `useSegmentOperations.ts`
**Extract:**
- Segment loading logic
- Segmentation operations
- Delete operations

**Benefits:**
- Isolated business logic
- Reusable hooks

#### 4.3 `useDocumentOperations.ts`
**Extract:**
- Document loading
- Document editing
- Parse status management

**Benefits:**
- Clear separation of concerns

## Implementation Order

### ✅ **DO NOW** (Low Risk, High Value):
1. Extract `WorkspaceToolbar.tsx` (~2-3 hours)
2. Extract `WorkspaceFilters.tsx` (~2-3 hours)
3. Extract custom hooks (`useWorkspaceState.ts`, `useSegmentOperations.ts`) (~3-4 hours)

**Total Time**: ~7-10 hours
**Risk**: Low
**Value**: High (reduces file by ~500-800 lines)

### ⏸️ **DO LATER** (When project is more stable):
4. Extract modal components
5. Extract list/viewer components

## File Structure After Extraction

```
src/
├── pages/
│   └── DocumentWorkspace.tsx (reduced to ~1,500-2,000 lines)
├── components/
│   └── workspace/
│       ├── WorkspaceToolbar.tsx
│       ├── WorkspaceFilters.tsx
│       ├── SegmentList.tsx
│       ├── SegmentViewer.tsx
│       ├── ManualChunkModal.tsx
│       ├── ChunkEditModal.tsx
│       └── DocumentEditModal.tsx
└── hooks/
    └── workspace/
        ├── useWorkspaceState.ts
        ├── useSegmentOperations.ts
        └── useDocumentOperations.ts
```

## Benefits of Component Extraction

1. **Maintainability** - Smaller, focused files
2. **Testability** - Easier to unit test isolated components
3. **Reusability** - Components can be reused elsewhere
4. **Performance** - Better memoization opportunities
5. **Collaboration** - Multiple developers can work on different components
6. **Debugging** - Easier to locate and fix issues

## Risks & Mitigation

### Risks:
- Breaking existing functionality
- Import path issues
- State management complexity
- Props drilling

### Mitigation:
- Extract incrementally (one component at a time)
- Test thoroughly after each extraction
- Use TypeScript for type safety
- Consider Context API for shared state if needed

## Recommendation

**Start with Phase 1** (Toolbar & Filters extraction) as it provides the highest value with the lowest risk. This will reduce the file size significantly and make future extractions easier.

