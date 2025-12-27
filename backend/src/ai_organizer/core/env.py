# backend/src/ai_organizer/core/env.py
from __future__ import annotations

import os
from pathlib import Path
from typing import List


def _backend_root() -> Path:
    """
    env.py βρίσκεται στο:
    backend/src/ai_organizer/core/env.py
    Άρα backend root = parents[3]
    """
    return Path(__file__).resolve().parents[3]


def _parse_origins(value: str) -> List[str]:
    value = (value or "").strip()
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


def resolve_data_dir() -> Path:
    """
    Priority:
    1) AIORG_DATA_DIR (absolute ή relative προς backend/)
    2) fallback: backend/data
    """
    raw = (os.getenv("AIORG_DATA_DIR") or "").strip()
    if raw:
        p = Path(raw)
        if not p.is_absolute():
            p = (_backend_root() / p).resolve()
    else:
        p = (_backend_root() / "data").resolve()

    # Ensure directories exist
    p.mkdir(parents=True, exist_ok=True)
    (p / "uploads").mkdir(parents=True, exist_ok=True)
    (p / "processed").mkdir(parents=True, exist_ok=True)

    return p


DATA_DIR: Path = resolve_data_dir()
UPLOADS_DIR: Path = DATA_DIR / "uploads"
PROCESSED_DIR: Path = DATA_DIR / "processed"
DB_PATH: Path = DATA_DIR / "app.db"

AIORG_HOST: str = (os.getenv("AIORG_HOST") or "127.0.0.1").strip()
AIORG_PORT: int = int((os.getenv("AIORG_PORT") or "8000").strip())

AIORG_JWT_SECRET: str = (os.getenv("AIORG_JWT_SECRET") or "").strip()

AIORG_CORS_ORIGINS: List[str] = _parse_origins(os.getenv("AIORG_CORS_ORIGINS") or "")
