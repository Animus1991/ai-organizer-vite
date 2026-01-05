from __future__ import annotations

import os
from typing import Iterable, List, Union

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_organizer.core.config import settings
from ai_organizer.core.db import ensure_data_dirs, create_db_and_tables
from ai_organizer.api.router import api_router
from fastapi.responses import FileResponse
from pathlib import Path

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

    return [p.strip() for p in s.split(",") if p.strip()]


origins = _normalize_origins(os.getenv("CORS_ORIGINS", None))

# ✅ fallback για dev
if not origins:
    origins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175"]

allow_all = len(origins) == 1 and origins[0] == "*"
allow_credentials = False if allow_all else True

app = FastAPI(title="AI Organizer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],  # (Authorization / Content-Type κ.λπ.)
)


@app.on_event("startup")
def on_startup() -> None:
    ensure_data_dirs()

    # ΜΟΝΟ αν θες quick dev create_all (default OFF)
    if os.getenv("AIORG_DEV_CREATE_ALL") == "1":
        create_db_and_tables()


# ✅ canonical API prefix
app.include_router(api_router, prefix="/api")


@app.get("/api/health")
def health_api():
    return {"ok": True}

STATIC_DIR = Path(__file__).resolve().parents[3] / "static"

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    ico = STATIC_DIR / "favicon.ico"
    if ico.exists():
        return FileResponse(ico)
    svg = STATIC_DIR / "favicon.svg"
    return FileResponse(svg)
