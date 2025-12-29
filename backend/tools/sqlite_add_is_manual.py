# backend/tools/sqlite_add_is_manual.py
from __future__ import annotations

import sqlite3
from pathlib import Path

from ai_organizer.core.env import DB_PATH

def column_exists(conn: sqlite3.Connection, table: str, col: str) -> bool:
    cur = conn.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cur.fetchall()]  # row[1] = name
    return col in cols

def main() -> None:
    db_path = Path(DB_PATH)
    if not db_path.exists():
        raise SystemExit(f"DB file not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    try:
        if not column_exists(conn, "segments", "is_manual"):
            print("Adding column segments.is_manual ...")
            # SQLite supports adding a column with a DEFAULT
            conn.execute("ALTER TABLE segments ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0")
            conn.commit()
            print("OK: column added.")
        else:
            print("OK: segments.is_manual already exists.")

        # sanity print
        cur = conn.execute("PRAGMA table_info(segments)")
        print("\nsegments columns:")
        for row in cur.fetchall():
            print(row)

    finally:
        conn.close()

if __name__ == "__main__":
    main()
