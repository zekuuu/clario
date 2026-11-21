import logging
from contextlib import asynccontextmanager
from pathlib import Path
from collections.abc import AsyncIterator, Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes import files, reports, setup, validation
from app.config.constants import API_PREFIX, APP_DISPLAY_NAME, APP_VERSION
from app.config.settings import get_settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging
from app.database.migrations import migrate

# Only the desktop shell and the Vite dev server may call the API from a browser context.
ALLOWED_ORIGINS = (
    "http://127.0.0.1:1420",
    "http://localhost:1420",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
)
# Rejects DNS-rebinding requests whose Host is an attacker domain resolving to 127.0.0.1.
# "testserver" is the host FastAPI's TestClient uses.
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "testserver"]
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def ensure_writable_data_directory(directory: Path) -> None:
    """Fail fast with a clear message, e.g. an all-users install whose data folder lost its write grant."""
    try:
        directory.mkdir(parents=True, exist_ok=True)
        probe = directory / ".write-test"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
    except OSError as error:
        logging.getLogger("clario").critical("Data folder %s is not writable: %s", directory, error)
        raise RuntimeError(f"Clario cannot write to its data folder: {directory}") from error


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    ensure_writable_data_directory(settings.data_directory)
    migrate()
    yield


_settings = get_settings()
app = FastAPI(
    title=APP_DISPLAY_NAME,
    version=APP_VERSION,
    docs_url="/docs" if _settings.enable_docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _settings.enable_docs else None,
    lifespan=lifespan,
)


@app.middleware("http")
async def reject_cross_site_writes(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """Block CSRF: browsers always send Origin on cross-site writes, including CORS-simple ones."""
    origin = request.headers.get("origin")
    if request.method in UNSAFE_METHODS and origin is not None and origin not in ALLOWED_ORIGINS:
        return JSONResponse(status_code=403, content={"code": "FORBIDDEN_ORIGIN", "detail": "Request origin is not allowed."})
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Accept", "Cache-Control", "Pragma"],
    expose_headers=["Content-Disposition", "X-Report-Filename"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)


@app.exception_handler(AppError)
async def handle_app_error(request: Request, error: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"code": error.code, "detail": error.message, "path": request.url.path},
    )


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": APP_DISPLAY_NAME, "version": APP_VERSION}


app.include_router(files.router, prefix=API_PREFIX)
app.include_router(validation.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
app.include_router(setup.router, prefix=API_PREFIX)
