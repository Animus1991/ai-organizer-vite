from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

# --- Make "src/" importable (εσύ τρέχεις app με --app-dir src) ---
BASE_DIR = Path(__file__).resolve().parents[1]  # .../backend
SRC_DIR = BASE_DIR / "src"

# Βάλε το src πρώτο στο sys.path για να μην "μπερδεύεται" με άλλα installs
src_str = str(SRC_DIR)
if src_str not in sys.path:
    sys.path.insert(0, src_str)

# --- Load app settings + import models so metadata is populated ---
from ai_organizer.core.config import settings  # noqa: E402
import ai_organizer.models  # noqa: E402  (φορτώνει τα SQLModel tables)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def get_url() -> str:
    # ✅ Single source: Always use settings.AIORG_DB_URL (absolute path)
    # This ensures migrations use the same database as the application
    url = getattr(settings, "AIORG_DB_URL", None)
    if url:
        return str(url)
    
    # Fallback: construct from DATA_DIR (should never happen if config.py is correct)
    from pathlib import Path
    db_path = getattr(settings, "AIORG_DATA_DIR", None)
    if db_path:
        db_file = Path(db_path) / "app.db"
        # Convert to absolute path and use forward slashes for SQLite URL
        db_file = db_file.resolve()
        return f"sqlite:///{db_file.as_posix()}"
    
    # Last resort fallback (should never happen)
    return "sqlite:///./data/app.db"


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            # SQLite χρειάζεται batch mode για ALTER TABLE + FKs
            render_as_batch=(connection.dialect.name == "sqlite"),
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
