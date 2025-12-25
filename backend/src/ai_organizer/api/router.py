from fastapi import APIRouter
from ai_organizer.api.routes.health import router as health_router
from ai_organizer.api.routes.upload import router as upload_router
from ai_organizer.api.routes.segment import router as segment_router
from ai_organizer.api.routes.auth import router as auth_router

api = APIRouter()
api.include_router(health_router, tags=["health"])
api.include_router(upload_router, tags=["upload"])
api.include_router(segment_router, tags=["segment"])
api.include_router(auth_router)

