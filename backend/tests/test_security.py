import io

from fastapi.testclient import TestClient

from app.main import app
from app.services.session_storage_service import safe_session_folder_name

client = TestClient(app)


def test_foreign_origin_gets_no_cors_grant() -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert "access-control-allow-origin" not in response.headers


def test_desktop_origin_gets_cors_grant() -> None:
    response = client.get("/health", headers={"Origin": "http://127.0.0.1:1420"})
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:1420"


def test_rebound_host_is_rejected() -> None:
    assert client.get("/health", headers={"Host": "evil.test"}).status_code == 400


def test_cross_site_write_is_rejected() -> None:
    response = client.post(
        "/api/v1/files/upload",
        headers={"Origin": "https://evil.test"},
        files=[("files", ("a.csv", io.BytesIO(b"a,b\n1,2\n"), "text/csv"))],
    )
    assert response.status_code == 403


def test_docs_disabled_by_default() -> None:
    assert client.get("/docs").status_code == 404


def test_upload_rejects_mismatched_signature() -> None:
    response = client.post(
        "/api/v1/files/upload",
        files=[("files", ("fake.xlsx", io.BytesIO(b"not a zip"), "application/octet-stream"))],
    )
    assert response.status_code == 415


def test_reserved_windows_names_are_suffixed() -> None:
    assert safe_session_folder_name("CON") == "CON session"
    assert safe_session_folder_name("nul.txt") == "nul.txt session"
    assert safe_session_folder_name("Q3 review") == "Q3 review"
