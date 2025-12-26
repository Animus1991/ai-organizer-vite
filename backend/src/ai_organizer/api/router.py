from fastapi import APIRouter
from ai_organizer.api.routes.health import router as health_router
from ai_organizer.api.routes.upload import router as upload_router
from ai_organizer.api.routes.segment import router as segment_router
from ai_organizer.api.routes.auth import router as auth_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(upload_router, tags=["upload"])
api_router.include_router(segment_router, tags=["segment"])

# ✅ κρατάμε τα auth endpoints κάτω από /api/auth/...
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
