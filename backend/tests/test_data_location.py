import io
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config.settings import default_data_directory, from_stored_path, get_settings, to_stored_path
from app.database.migrations import migrate
from app.main import app


class DefaultDataDirectoryTests(unittest.TestCase):
    def test_source_runs_use_backend_data(self) -> None:
        backend_dir = Path(__file__).resolve().parents[1]
        self.assertEqual(default_data_directory(), backend_dir / "data")

    def test_packaged_runs_use_folder_next_to_the_exe(self) -> None:
        exe = Path(tempfile.mkdtemp()) / "Clario" / "clario-backend.exe"
        with patch.object(sys, "frozen", True, create=True), patch.object(sys, "executable", str(exe)):
            self.assertEqual(default_data_directory(), exe.resolve().parent / "data")


class StoredPathTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = get_settings()
        self.original = self.settings.data_directory
        self.settings.data_directory = Path(tempfile.mkdtemp(prefix="clario-paths-"))

    def tearDown(self) -> None:
        self.settings.data_directory = self.original

    def test_paths_inside_data_folder_are_stored_relative(self) -> None:
        inside = self.settings.data_directory / "sessions" / "A" / "uploads" / "x.xlsx"
        self.assertEqual(to_stored_path(inside), "sessions/A/uploads/x.xlsx")
        self.assertEqual(from_stored_path("sessions/A/uploads/x.xlsx"), self.settings.data_directory / "sessions/A/uploads/x.xlsx")

    def test_absolute_paths_outside_are_kept(self) -> None:
        outside = Path(tempfile.mkdtemp()) / "elsewhere.pdf"
        self.assertEqual(from_stored_path(to_stored_path(outside)), outside.resolve())


class LegacyDataMigrationTests(unittest.TestCase):
    """Builds a fake pre-installer ~/.clario with absolute paths, then imports it into a fresh data folder."""

    def setUp(self) -> None:
        self.settings = get_settings()
        self.original_data = self.settings.data_directory
        self.original_legacy = self.settings.legacy_data_directory
        self.legacy = Path(tempfile.mkdtemp(prefix="clario-legacy-"))
        self.new = Path(tempfile.mkdtemp(prefix="clario-new-"))
        self._build_legacy_folder()
        self.settings.data_directory = self.new
        self.settings.legacy_data_directory = self.legacy
        migrate()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        self.settings.data_directory = self.original_data
        self.settings.legacy_data_directory = self.original_legacy

    def _build_legacy_folder(self) -> None:
        self.settings.data_directory = self.legacy
        migrate()
        with TestClient(app) as client:
            uploaded = client.post(
                "/api/v1/files/upload",
                files=[("files", ("items.csv", io.BytesIO(b"Item,Quantity\nBond Paper,10\n"), "text/csv"))],
            ).json()[0]
            draft = client.post(
                "/api/v1/validation/sessions/draft",
                json={"project_name": "Old session", "file_names": [uploaded["name"]], "uploaded_file_ids": [uploaded["id"]]},
            ).json()
            run = client.post("/api/v1/validation/run", json={"project_name": "Old session", "session_id": draft["id"], "data_sources": [], "rules": []}).json()
            client.post("/api/v1/reports/pdf", json=run)
        self.session_id = draft["id"]
        # Older versions stored absolute paths; simulate that so the rewrite is exercised.
        connection = sqlite3.connect(self.legacy / "clario.sqlite3")
        connection.execute("UPDATE sessions SET session_path = ?", (str(self.legacy / "sessions" / "Old session"),))
        report_rows = connection.execute("SELECT rowid, path FROM reports").fetchall()
        for rowid, path in report_rows:
            connection.execute("UPDATE reports SET path = ? WHERE rowid = ?", (str(self.legacy / path), rowid))
        connection.commit()
        connection.close()
        metadata_file = self.legacy / "sessions" / "Old session" / "session.json"
        metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
        for item in metadata["files"]:
            item["path"] = str(self.legacy / item["path"])
        metadata_file.write_text(json.dumps(metadata), encoding="utf-8")

    def _status(self) -> dict:
        return self.client.get("/api/v1/setup/legacy-data").json()

    def test_offered_once_with_session_count(self) -> None:
        self.assertEqual(self._status(), {"available": True, "session_count": 1})

    def test_copy_imports_sessions_and_keeps_original(self) -> None:
        response = self.client.post("/api/v1/setup/legacy-data", json={"action": "copy"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"action": "copy", "imported_sessions": 1})
        self.assertTrue((self.legacy / "clario.sqlite3").exists())
        self.assertFalse(self._status()["available"])

        # Paths now point inside the new folder and the session reopens with its file and report.
        connection = sqlite3.connect(self.new / "clario.sqlite3")
        session_path = connection.execute("SELECT session_path FROM sessions").fetchone()[0]
        report_path = connection.execute("SELECT path FROM reports").fetchone()[0]
        connection.close()
        self.assertEqual(session_path, "sessions/Old session")
        self.assertFalse(Path(report_path).is_absolute())
        state = self.client.get(f"/api/v1/validation/sessions/{self.session_id}").json()
        self.assertEqual([item["name"] for item in state["files"]], ["items.csv"])
        saved = self.client.get(f"/api/v1/reports/{self.session_id}/saved").json()
        self.assertEqual(len(saved), 1)

    def test_move_removes_original_folder(self) -> None:
        self.assertEqual(self.client.post("/api/v1/setup/legacy-data", json={"action": "move"}).status_code, 200)
        self.assertFalse(self.legacy.exists())
        self.assertEqual(len(self.client.get("/api/v1/validation/recent").json()), 1)

    def test_skip_changes_nothing_and_is_remembered(self) -> None:
        self.assertEqual(self.client.post("/api/v1/setup/legacy-data", json={"action": "skip"}).json()["imported_sessions"], 0)
        self.assertTrue((self.legacy / "clario.sqlite3").exists())
        self.assertEqual(self.client.get("/api/v1/validation/recent").json(), [])
        self.assertFalse(self._status()["available"])
        self.assertEqual(self.client.post("/api/v1/setup/legacy-data", json={"action": "copy"}).status_code, 409)

    def test_rejects_unknown_action(self) -> None:
        self.assertEqual(self.client.post("/api/v1/setup/legacy-data", json={"action": "delete"}).status_code, 422)
