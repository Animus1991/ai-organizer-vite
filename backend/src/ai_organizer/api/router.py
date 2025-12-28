from fastapi import APIRouter

from ai_organizer.api.routes.health import router as health_router
from ai_organizer.api.routes.auth import router as auth_router
from ai_organizer.api.routes.upload import router as upload_router
from ai_organizer.api.routes.segment import router as segment_router
from ai_organizer.api.routes.upload_delete import router as upload_delete_router
from ai_organizer.api.routes.documents import router as documents_router  # ✅ add

api_router = APIRouter()

# /api/health
api_router.include_router(health_router, tags=["health"])

# /api/auth/*
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])

# /api/uploads (GET/POST etc, ό,τι έχεις στο upload.py)
api_router.include_router(upload_router, tags=["upload"])

# /api/documents/{id}/segment + /api/documents/{id}/segments
api_router.include_router(segment_router, tags=["segment"])

# /api/uploads/{upload_id} (DELETE) + (προαιρετικά) /api/documents/{document_id} (DELETE)
api_router.include_router(upload_delete_router, tags=["upload-delete"])

# ✅ /api/documents/{id}
api_router.include_router(documents_router, tags=["documents"])
