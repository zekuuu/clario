import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.config.settings import get_settings
from app.database.migrations import migrate
from app.main import app


class ReportsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = get_settings()
        self.original_data_directory = self.settings.data_directory
        self.settings.data_directory = Path(tempfile.mkdtemp(prefix="clario-report-test-"))
        migrate()
        self.client = TestClient(app)
        run = self.client.post("/api/v1/validation/run", json={"project_name": "Report session", "data_sources": [], "rules": []})
        self.assertEqual(run.status_code, 200)
        self.result = run.json()
        pdf = self.client.post("/api/v1/reports/pdf", json=self.result)
        self.assertEqual(pdf.status_code, 200)
        self.pdf_response = pdf

    def tearDown(self) -> None:
        self.client.close()
        self.settings.data_directory = self.original_data_directory

    def test_responses_do_not_expose_filesystem_paths(self) -> None:
        self.assertNotIn("x-report-path", self.pdf_response.headers)
        saved = self.client.get(f"/api/v1/reports/{self.result['id']}/saved").json()
        self.assertEqual(len(saved), 1)
        self.assertEqual(set(saved[0]), {"filename", "created_at"})
        recent = self.client.get("/api/v1/validation/recent").json()
        self.assertNotIn("session_path", recent[0])

    def test_open_by_filename_and_reject_traversal(self) -> None:
        filename = self.pdf_response.headers["x-report-filename"]
        with patch("app.api.routes.reports.open_with_default_app") as opener:
            ok = self.client.post(f"/api/v1/reports/{self.result['id']}/open", json={"filename": filename})
            self.assertEqual(ok.status_code, 200)
            self.assertEqual(ok.json(), {"status": "opened", "filename": filename})
            opener.assert_called_once()
            for bad in ("../session.json", "..\..\clario.sqlite3", "C:/Windows/notepad.exe"):
                response = self.client.post(f"/api/v1/reports/{self.result['id']}/open", json={"filename": bad})
                self.assertEqual(response.status_code, 404, bad)
            self.assertEqual(opener.call_count, 1)
