"""One-time import of data from the pre-installer ~/.clario folder into the current data folder."""

import json
import shutil
import sqlite3
from pathlib import Path
from typing import Literal

from app.config.settings import CLARIO_DATABASE_NAME, get_settings
from app.core.exceptions import AppError
from app.database.connection import database
from app.database.migrations import migrate

LegacyAction = Literal["move", "copy", "skip"]
DECISION_KEY = "legacy_data_decision"


def _legacy_root() -> Path:
    return get_settings().legacy_data_directory


def _legacy_database() -> Path:
    return _legacy_root() / CLARIO_DATABASE_NAME


def _stored_decision() -> str | None:
    with database() as connection:
        row = connection.execute("SELECT value FROM settings WHERE key = ?", (DECISION_KEY,)).fetchone()
    return str(row["value"]) if row else None


def _record_decision(action: LegacyAction) -> None:
    with database() as connection:
        connection.execute("INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)", (DECISION_KEY, action))


def _count_sessions(database_path: Path) -> int:
    if not database_path.is_file():
        return 0
    connection = sqlite3.connect(f"file:{database_path.as_posix()}?mode=ro", uri=True)
    try:
        return int(connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0])
    except sqlite3.DatabaseError:
        return 0
    finally:
        connection.close()


def legacy_status() -> dict[str, object]:
    """Offer the import only once, only if old data exists, and only while the new folder has no sessions."""
    legacy_db = _legacy_database()
    same_folder = _legacy_root().resolve() == get_settings().data_directory.resolve()
    if same_folder or not legacy_db.is_file() or _stored_decision() is not None:
        return {"available": False, "session_count": 0}
    if _count_sessions(get_settings().database_path) > 0:
        return {"available": False, "session_count": 0}
    return {"available": True, "session_count": _count_sessions(legacy_db)}


def _relative_to_legacy(raw: object) -> object:
    """Absolute paths under ~/.clario become data-folder-relative; anything else is kept as-is."""
    if not isinstance(raw, str) or not raw:
        return raw
    path = Path(raw)
    if not path.is_absolute():
        return raw
    try:
        return path.resolve().relative_to(_legacy_root().resolve()).as_posix()
    except ValueError:
        return raw


def _copy_files(target: Path) -> None:
    for item in _legacy_root().iterdir():
        if item.name.startswith(CLARIO_DATABASE_NAME):
            continue  # the database is copied with SQLite's backup API instead
        destination = target / item.name
        if item.is_dir():
            shutil.copytree(item, destination, dirs_exist_ok=True)
        else:
            shutil.copy2(item, destination)


def _copy_database() -> None:
    source = sqlite3.connect(f"file:{_legacy_database().as_posix()}?mode=ro", uri=True)
    destination = sqlite3.connect(get_settings().database_path)
    try:
        source.backup(destination)
    finally:
        source.close()
        destination.close()
    migrate()  # bring an older schema up to date


def _rewrite_paths(target: Path) -> None:
    with database() as connection:
        for table, column in (("sessions", "session_path"), ("reports", "path")):
            # Table and column names come from the fixed tuple above, never from input.
            rows = connection.execute(f"SELECT rowid, {column} FROM {table}").fetchall()  # noqa: S608
            for row in rows:
                updated = _relative_to_legacy(row[column])
                if updated != row[column]:
                    connection.execute(f"UPDATE {table} SET {column} = ? WHERE rowid = ?", (updated, row["rowid"]))  # noqa: S608
    for metadata_file in (target / "sessions").glob("*/session.json"):
        try:
            metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for item in metadata.get("files") or []:
            if isinstance(item, dict) and "path" in item:
                item["path"] = _relative_to_legacy(item["path"])
        metadata_file.write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def apply_legacy_action(action: LegacyAction) -> dict[str, object]:
    status = legacy_status()
    if not status["available"]:
        raise AppError("There is no earlier data to import.", "LEGACY_DATA_UNAVAILABLE", 409)
    if action == "skip":
        _record_decision("skip")
        return {"action": "skip", "imported_sessions": 0}

    target = get_settings().data_directory
    expected = int(status["session_count"])
    _copy_files(target)
    _copy_database()
    _rewrite_paths(target)
    imported = _count_sessions(get_settings().database_path)
    if imported != expected:
        raise AppError(
            "The earlier data could not be copied completely; the original folder was left untouched.",
            "LEGACY_COPY_INCOMPLETE",
            500,
        )
    # Recorded after the DB copy, which replaces the settings table.
    _record_decision(action)
    if action == "move":
        shutil.rmtree(_legacy_root(), ignore_errors=True)
    return {"action": action, "imported_sessions": imported}
