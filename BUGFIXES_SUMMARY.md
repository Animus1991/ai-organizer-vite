# Bug Fixes Summary - Database & Auth Issues

## Issues Fixed

### 1. ✅ "Database initialization warning: name 'engine' is not defined"

**Problem**: `main.py` was using `engine` without importing it.

**Fix**: Added `engine` to imports from `ai_organizer.core.db`

**File**: `backend/src/ai_organizer/main.py`

---

### 2. ✅ Users Lost After Restart (Database Path Inconsistency)

**Problem**: Database path was inconsistent between:
- `db.py` using `Path("./data").resolve()` (relative, changes with working directory)
- `config.py` using `BACKEND_DIR / "data"` (absolute)
- `alembic/env.py` using different fallback logic

This caused the database to be created in different locations, losing users.

**Fix**:
1. Updated `_get_data_dir()` in `db.py` to use `BACKEND_DIR` (absolute path)
2. Updated `_get_db_url()` to always use `settings.AIORG_DB_URL` (which is always absolute)
3. Synchronized `alembic/env.py` to use same logic as `db.py`

**Files Modified**:
- `backend/src/ai_organizer/core/db.py`
- `backend/alembic/env.py`

**Result**: Database always uses the same absolute path, regardless of working directory.

---

### 3. ✅ 401 Unauthorized Errors in Console

**Problem**: `apiClient.ts` was not checking if `refreshTokens()` returned `null` before using the token.

**Fix**: Added null check - if refresh fails, clear tokens and reject the request.

**File**: `src/api/apiClient.ts`

---

## Verification Steps

### 1. Database Path Consistency
```bash
# Check database location
cd backend
python -c "from src.ai_organizer.core.config import settings; print(settings.AIORG_DB_URL)"
python -c "from src.ai_organizer.core.db import DB_URL; print(DB_URL)"

# Both should show the same absolute path
```

### 2. Users Persist After Restart
1. Create a user via API
2. Restart backend
3. Verify user still exists (login should work)

### 3. No More 401 Errors
1. Open browser console
2. Login to application
3. Verify no 401 errors appear
4. If token expires, refresh should work automatically

---

## Notes

- All database paths are now absolute and consistent
- Alembic migrations use the same database as the application
- Auth refresh properly handles failures
- No breaking changes - all fixes are backward compatible

