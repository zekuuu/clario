import sys
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

CLARIO_DATABASE_NAME = "clario.sqlite3"
# Where versions before the installer kept their data; only read by the one-time migration.
LEGACY_DATA_DIRECTORY = Path.home() / ".clario"


def default_data_directory() -> Path:
    """Data lives next to the program: `<install folder>/data` when packaged, `backend/data` from source."""
    if getattr(sys, "frozen", False):
        # In a PyInstaller one-file build sys.executable is the installed exe, not the temp unpack folder.
        return Path(sys.executable).resolve().parent / "data"
    return Path(__file__).resolve().parents[2] / "data"


class Settings(BaseSettings):
    """Centralized runtime settings; defaults remain safe for local desktop use."""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        populate_by_name=True,
    )

    host: str = Field(
        default="127.0.0.1",
        pattern=r"^(127\.0\.0\.1|localhost)$",
        validation_alias=AliasChoices("CLARIO_HOST", "PROCUREMENT_VALIDATOR_HOST"),
    )
    port: int = Field(
        default=8766,
        ge=1024,
        le=65535,
        validation_alias=AliasChoices("CLARIO_PORT", "PROCUREMENT_VALIDATOR_PORT"),
    )
    log_level: str = Field(
        default="INFO",
        validation_alias=AliasChoices("CLARIO_LOG_LEVEL", "PROCUREMENT_VALIDATOR_LOG_LEVEL"),
    )
    enable_docs: bool = Field(
        default=False,
        validation_alias=AliasChoices("CLARIO_ENABLE_DOCS"),
    )
    data_directory: Path = Field(
        default_factory=default_data_directory,
        validation_alias=AliasChoices("CLARIO_DATA_DIRECTORY", "PROCUREMENT_VALIDATOR_DATA_DIRECTORY"),
    )
    # Old ~/.clario location offered for a one-time migration; overridable so tests never touch the real one.
    legacy_data_directory: Path = Field(
        default=LEGACY_DATA_DIRECTORY,
        validation_alias=AliasChoices("CLARIO_LEGACY_DATA_DIRECTORY"),
    )

    @property
    def database_path(self) -> Path:
        return self.data_directory / CLARIO_DATABASE_NAME

    @property
    def sessions_directory(self) -> Path:
        return self.data_directory / "sessions"

    @property
    def upload_directory(self) -> Path:
        return self.data_directory / "working-files"

    @property
    def report_directory(self) -> Path:
        return self.data_directory / "reports"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def to_stored_path(path: Path | str) -> str:
    """Paths saved in the DB and session.json are relative to the data folder, so the folder can move."""
    resolved = Path(path).resolve()
    try:
        return resolved.relative_to(get_settings().data_directory.resolve()).as_posix()
    except ValueError:
        return str(resolved)


def from_stored_path(raw: str | Path) -> Path:
    """Inverse of to_stored_path; absolute paths saved by older versions are returned unchanged."""
    path = Path(str(raw))
    return path if path.is_absolute() else get_settings().data_directory / path
