# backend/src/ai_organizer/core/config.py
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv


# .../backend/src/ai_organizer/core/config.py -> parents[3] = .../backend
BACKEND_DIR = Path(__file__).resolve().parents[3]

# Always load backend/.env
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)


def _as_posix(p: Path) -> str:
    # sqlite URL needs forward slashes even on Windows
    return p.resolve().as_posix()


@dataclass(frozen=True)
class Settings:
    AIORG_CORS_ORIGINS: str = field(default_factory=lambda: os.getenv("AIORG_CORS_ORIGINS", "http://localhost:5173"))
    AIORG_HOST: str = field(default_factory=lambda: os.getenv("AIORG_HOST", "127.0.0.1"))
    AIORG_PORT: int = field(default_factory=lambda: int(os.getenv("AIORG_PORT", "8000")))

    AIORG_JWT_SECRET: str = field(default_factory=lambda: os.getenv("AIORG_JWT_SECRET", "CHANGE_ME"))
    AIORG_JWT_ALG: str = field(default_factory=lambda: os.getenv("AIORG_JWT_ALG", "HS256"))
    AIORG_ACCESS_MINUTES: int = field(default_factory=lambda: int(os.getenv("AIORG_ACCESS_MINUTES", "30")))
    AIORG_REFRESH_DAYS: int = field(default_factory=lambda: int(os.getenv("AIORG_REFRESH_DAYS", "14")))

    # Filled in __post_init__
    AIORG_DATA_DIR: Path = field(init=False)
    AIORG_UPLOAD_DIR: Path = field(init=False)
    AIORG_DB_URL: str = field(init=False)

    def __post_init__(self) -> None:
        data_dir = Path(os.getenv("AIORG_DATA_DIR", str((BACKEND_DIR / "data").resolve()))).resolve()
        upload_dir = Path(os.getenv("AIORG_UPLOAD_DIR", str((data_dir / "uploads").resolve()))).resolve()

        db_url = os.getenv("AIORG_DB_URL", "").strip()
        if not db_url:
            db_path = (data_dir / "app.db").resolve()
            db_url = f"sqlite:///{_as_posix(db_path)}"

        object.__setattr__(self, "AIORG_DATA_DIR", data_dir)
        object.__setattr__(self, "AIORG_UPLOAD_DIR", upload_dir)
        object.__setattr__(self, "AIORG_DB_URL", db_url)


settings = Settings()
settings.AIORG_DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.AIORG_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
