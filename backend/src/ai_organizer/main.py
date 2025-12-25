from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_organizer.core.config import settings
from ai_organizer.core.db import create_db_and_tables
from ai_organizer.api.router import api

app = FastAPI(title="AI Organizer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.AIORG_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# canonical API prefix
app.include_router(api, prefix="/api")

# προαιρετικό legacy (αν θες να κρατήσεις /health):
@app.get("/health")
def health_root():
    return {"ok": True}
