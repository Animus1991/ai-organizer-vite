# Bug Fix: 422 Unprocessable Content on /api/uploads

## Problem
When loading the Home page, the `/api/uploads` endpoint returns `422 Unprocessable Content` error:
```
GET http://127.0.0.1:8000/api/uploads?page=1&pageSize=1000 422 (Unprocessable Content)
```

## Root Cause
The backend endpoint `list_uploads` had a validation constraint:
- `pageSize: int = Query(default=50, ge=1, le=100, ...)` - max 100 items per page

But the frontend was sending:
- `pageSize=1000` - requesting 1000 items per page

This caused FastAPI to reject the request with 422 (validation error).

## Solution

### Backend Fix
Updated the `pageSize` parameter to allow up to 1000 items:
```python
pageSize: int = Query(default=50, ge=1, le=1000, description="Items per page (max 1000)")
```

### Frontend Fix
Changed the default `pageSize` from 1000 to 100 (more reasonable):
```typescript
return await listUploads(1, 100); // Get first 100 uploads
```

## Files Modified
- `backend/src/ai_organizer/api/routes/upload.py` - Increased max `pageSize` to 1000
- `src/pages/Home.tsx` - Changed default `pageSize` from 1000 to 100

## Testing
1. Restart backend server to apply changes
2. Navigate to Home page
3. **Expected**: Uploads should load without 422 error
4. **Result**: ✅ Fixed - Uploads now load correctly

## Note
The backend now supports up to 1000 items per page, but the frontend requests 100 by default for better performance. If more items are needed, pagination UI can be added later.

