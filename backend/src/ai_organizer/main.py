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

    # If it's already a list/tuple/set/etc (but not a string), convert to list
    if isinstance(value, (list, tuple, set)):
        return [str(x).strip() for x in value if str(x).strip()]

    # Otherwise treat as string
    s = str(value).strip()
    if not s:
        return []

    # Allow comma-separated origins
    parts = [p.strip() for p in s.split(",")]
    return [p for p in parts if p]


origins = _normalize_origins(getattr(settings, "AIORG_CORS_ORIGINS", None))

# If someone sets AIORG_CORS_ORIGINS="*", FastAPI/Starlette won't allow credentials with "*".
allow_all = len(origins) == 1 and origins[0] == "*"
allow_credentials = False if allow_all else True

app = FastAPI(title="AI Organizer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()

# Canonical API prefix
app.include_router(api_router, prefix="/api")

# Simple root health endpoint (useful for quick checks)
@app.get("/health")
def health_root():
    return {"ok": True}
