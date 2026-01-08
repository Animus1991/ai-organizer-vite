# Bug Fix: Uploads Not Showing on Home Page

## Problem
When returning to the Home page, previously uploaded documents were not appearing in the dropdown list. However, when re-uploading the same file, the system remembered the segmentation and segments (deduplication working).

## Root Cause
1. **Cache Invalidation Issue**: The cache key for `/api/uploads` included query parameters (`?page=1&pageSize=1000`), but cache invalidation after upload only deleted the cache key without query params. This caused the cached response with query params to persist.

2. **Missing Refresh on Navigation**: When returning to the Home page, `fetchUploads()` was not being called because the `useEffect` with `[user]` dependency only runs when the user changes, not when navigating back to the page.

## Solution

### 1. Enhanced Cache Invalidation
- Added `deleteByPrefix()` method to `SimpleCache` class
- Updated cache invalidation to clear all cache keys that start with the base cache key
- This ensures all variations (with/without query params) are cleared

**Files Modified**:
- `src/lib/cache.ts` - Added `deleteByPrefix()` method
- `src/lib/api.ts` - Updated cache invalidation to use `deleteByPrefix()`

### 2. Navigation-Aware Refresh
- Added `useLocation` hook to detect navigation changes
- Added `useEffect` that triggers `fetchUploads()` when returning to Home page
- Clears cache before fetching to ensure fresh data

**Files Modified**:
- `src/pages/Home.tsx` - Added location-based refresh logic

## Changes Made

### `src/lib/cache.ts`
```typescript
// Added method to delete all keys with a given prefix
deleteByPrefix(prefix: string): void {
  const keysToDelete: string[] = [];
  for (const key of this.cache.keys()) {
    if (key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => this.cache.delete(key));
}
```

### `src/lib/api.ts`
```typescript
// Updated cache invalidation
if (url.includes('/uploads') || url.includes('/upload')) {
  const baseCacheKey = 'cache:' + API_BASE + '/api/uploads';
  apiCache.deleteByPrefix(baseCacheKey); // Clears all variations
}
```

### `src/pages/Home.tsx`
```typescript
// Added location-based refresh
useEffect(() => {
  if (user && location.pathname === '/' && hasFetchedRef.current) {
    const baseCacheKey = 'cache:http://127.0.0.1:8000/api/uploads';
    apiCache.deleteByPrefix(baseCacheKey);
    fetchUploads();
  }
}, [location.pathname, user]);
```

## Testing
1. Upload a document
2. Navigate to DocumentWorkspace
3. Return to Home page
4. **Expected**: Document should appear in dropdown
5. **Result**: ✅ Fixed - Document now appears correctly

## Verification Steps
1. Upload a new document
2. Verify it appears in the dropdown
3. Navigate away from Home page
4. Return to Home page
5. Verify the document still appears in the dropdown
6. Upload the same file again
7. Verify deduplication works (segmentation remembered)

## Status
✅ **FIXED** - Uploads now appear correctly when returning to Home page

