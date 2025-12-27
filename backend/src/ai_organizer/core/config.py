from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
from dotenv import load_dotenv

# ✅ stable backend dir: .../backend
BACKEND_DIR = Path(__file__).resolve().parents[3]

# ✅ always load the SAME .env (inside backend/)
load_dotenv(dotenv_path=BACKEND_DIR / ".env")

def _as_posix(p: Path) -> str:
    # sqlite URL needs forward slashes even on Windows
    return p.resolve().as_posix()

@dataclass(frozen=True)
class Settings:
    # ✅ One true data directory
    AIORG_DATA_DIR: Path = Path(
        os.getenv("AIORG_DATA_DIR", str((BACKEND_DIR / "data").resolve()))
    ).resolve()

    AIORG_CORS_ORIGINS: str = os.getenv("AIORG_CORS_ORIGINS", "http://localhost:5173")
    AIORG_HOST: str = os.getenv("AIORG_HOST", "127.0.0.1")
    AIORG_PORT: int = int(os.getenv("AIORG_PORT", "8000"))

    # ✅ DB always inside AIORG_DATA_DIR unless overridden
    _db_path: Path = (AIORG_DATA_DIR / "app.db")  # type: ignore
    AIORG_DB_URL: str = os.getenv("AIORG_DB_URL", f"sqlite:///{_as_posix(_db_path)}")

    # ✅ Uploads always inside AIORG_DATA_DIR/uploads unless overridden
    AIORG_UPLOAD_DIR: Path = Path(
        os.getenv("AIORG_UPLOAD_DIR", str((AIORG_DATA_DIR / "uploads").resolve()))
    ).resolve()

    # ✅ Secret must be stable (set in backend/.env)
    AIORG_JWT_SECRET: str = os.getenv("AIORG_JWT_SECRET", "CHANGE_ME")
    AIORG_JWT_ALG: str = os.getenv("AIORG_JWT_ALG", "HS256")
    AIORG_ACCESS_MINUTES: int = int(os.getenv("AIORG_ACCESS_MINUTES", "30"))
    AIORG_REFRESH_DAYS: int = int(os.getenv("AIORG_REFRESH_DAYS", "14"))

settings = Settings()
settings.AIORG_DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.AIORG_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
