from __future__ import annotations

from typing import Iterable, List, Union

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_organizer.core.config import settings
from ai_organizer.core.db import create_db_and_tables
from ai_organizer.api.router import api_router


def _normalize_origins(value: Union[str, Iterable[str], None]) -> List[str]:
    """
    Accepts:
      - "http://localhost:5173"
      - "http://localhost:5173,http://127.0.0.1:5173"
      - ["http://localhost:5173", "http://127.0.0.1:5173"]
      - None
    Returns a clean list of origins.
    """
    if value is None:
        return []

    if isinstance(value, (list, tuple, set)):
        return [str(x).strip() for x in value if str(x).strip()]

    s = str(value).strip()
    if not s:
        return []

    parts = [p.strip() for p in s.split(",")]
    return [p for p in parts if p]


origins = _normalize_origins(getattr(settings, "AIORG_CORS_ORIGINS", None))

# ✅ fallback για dev, αν δεν έχει οριστεί env
if not origins:
    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

allow_all = len(origins) == 1 and origins[0] == "*"
allow_credentials = False if allow_all else True

app = FastAPI(title="AI Organizer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # ΠΟΛΥ σημαντικό για Authorization
)

@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()

# ✅ canonical API prefix
app.include_router(api_router, prefix="/api")

@app.get("/health")
def health_root():
    return {"ok": True}
