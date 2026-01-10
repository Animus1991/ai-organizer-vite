# P0-3: Fork-on-Edit for Auto Segments Implementation

## Summary

Implemented fork-on-edit mechanism for auto-generated segments. Editing an auto segment creates a new manual segment instead of mutating the original, preserving re-segmentation determinism.

## Changes Made

### Updated PATCH Endpoint
**File**: `backend/src/ai_organizer/api/routes/segment.py`
- **Function**: `patch_segment()`
- **Before**: Mutated segment in-place regardless of `is_manual` flag
- **After**: 
  - Checks `is_manual` flag
  - If `is_manual=False` (auto segment):
    - Creates new manual segment with edited content
    - Original auto segment remains unchanged
    - Returns new manual segment ID
  - If `is_manual=True` (manual segment):
    - Updates in-place (existing behavior)

### Architecture Compliance

✅ **Auto Segment Immutability**: Auto segments (`is_manual=False`) are never mutated  
✅ **Fork-on-Edit**: Editing auto segment creates new manual segment  
✅ **Re-segmentation Determinism**: Re-segmentation restores original auto segments  
✅ **Manual Segment Mutability**: Manual segments can be edited in-place

### Implementation Details

1. **Auto Segment Fork Flow**:
   ```
   PATCH /segments/{id} (is_manual=False)
   → Create new Segment with is_manual=True
   → Original auto segment unchanged
   → Return new segment ID
   ```

2. **Manual Segment Update Flow**:
   ```
   PATCH /segments/{id} (is_manual=True)
   → Update segment in-place
   → Return same segment ID
   ```

3. **Re-segmentation Behavior** (already implemented):
   ```
   POST /documents/{id}/segment
   → Preserve all segments with is_manual=True
   → Delete all segments with is_manual=False
   → Create new auto segments
   → Re-index manual segments after auto segments
   ```

## Files Changed

- `backend/src/ai_organizer/api/routes/segment.py` - Updated `patch_segment()` function

## Verification

✅ **Code Compiles**: File compiles without errors  
✅ **Linter Clean**: No linter errors  
✅ **Imports Work**: `patch_segment` imports successfully  
✅ **Re-segmentation Compatible**: Re-segmentation endpoint already preserves manual segments

## Testing Required

- [ ] Edit auto segment → verify new manual segment created, original unchanged
- [ ] GET original auto segment → verify content unchanged
- [ ] GET new manual segment → verify edited content
- [ ] Edit manual segment → verify updates in-place (same ID)
- [ ] Re-segment document → verify auto segments restored, manual segments preserved
- [ ] Multiple edits → verify all manual segments preserved on re-segmentation

## Breaking Changes

**Frontend Impact**: When editing an auto segment, the API returns a new segment ID instead of the original ID. Frontend must handle this:

```typescript
// Before (didn't work correctly for auto segments anyway)
const updated = await patchSegment(segmentId, { content: "edited" });
// updated.id === segmentId (always)

// After (fork-on-edit)
const updated = await patchSegment(segmentId, { content: "edited" });
// If original was auto: updated.id !== segmentId (new manual segment)
// If original was manual: updated.id === segmentId (updated in-place)
```

**Recommendation**: Frontend should:
1. Use `updated.id` instead of assuming `segmentId`
2. Remove old auto segment from UI (if edited)
3. Add new manual segment to UI
4. Or: Keep both (original auto + new manual) and mark original as "edited"

## Integration with P0-2

✅ **Compatible**: Both P0-2 (document versioning) and P0-3 (segment fork-on-edit) work together
- Document versioning preserves original document text
- Segment fork-on-edit preserves original auto segments
- Re-segmentation uses original document text (version 0)
- All manual edits are preserved

## Next Steps

Ready for testing and frontend updates (if needed)

---

**Last Updated**: 2025-01-XX  
**Status**: Implementation Complete, Testing Pending