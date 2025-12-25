from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Settings:
    AIORG_DATA_DIR: Path = Path(os.getenv("AIORG_DATA_DIR", "../data")).resolve()
    AIORG_CORS_ORIGINS: str = os.getenv("AIORG_CORS_ORIGINS", "http://localhost:5173")
    AIORG_HOST: str = os.getenv("AIORG_HOST", "127.0.0.1")
    AIORG_PORT: int = int(os.getenv("AIORG_PORT", "8000"))
    AIORG_DB_URL: str = os.getenv("AIORG_DB_URL", "sqlite:///./data/app.db")
    AIORG_UPLOAD_DIR: Path = Path(os.getenv("AIORG_UPLOAD_DIR", "./data/uploads")).resolve()
    AIORG_JWT_SECRET: str = os.getenv("AIORG_JWT_SECRET", "CHANGE_ME")
    AIORG_JWT_ALG: str = os.getenv("AIORG_JWT_ALG", "HS256")
    AIORG_ACCESS_MINUTES: int = int(os.getenv("AIORG_ACCESS_MINUTES", "30"))
    AIORG_REFRESH_DAYS: int = int(os.getenv("AIORG_REFRESH_DAYS", "14"))


settings = Settings()
settings.AIORG_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.AIORG_DATA_DIR.mkdir(parents=True, exist_ok=True)
