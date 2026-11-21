"""Entry point for the packaged backend (PyInstaller sidecar launched by the Tauri shell).

Development keeps using `uvicorn app.main:app --reload` via run-dev.ps1; this module exists so a
frozen executable can start the same app without the uvicorn CLI.
"""

import argparse
import os
import sys
import threading

import uvicorn

from app.config.settings import get_settings
from app.main import app


def exit_when_parent_exits(parent_pid: int) -> None:
    """Stop the backend if the desktop shell dies, so no orphan keeps port 8766 busy."""

    def watch() -> None:
        if sys.platform == "win32":
            import ctypes

            synchronize = 0x00100000
            infinite = 0xFFFFFFFF
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.OpenProcess(synchronize, False, parent_pid)
            if not handle:
                os._exit(0)
            kernel32.WaitForSingleObject(handle, infinite)
            os._exit(0)
        else:
            import time

            while os.getppid() == parent_pid:
                time.sleep(1)
            os._exit(0)

    threading.Thread(target=watch, name="parent-watchdog", daemon=True).start()


def main() -> None:
    parser = argparse.ArgumentParser(description="Clario local backend")
    parser.add_argument("--parent-pid", type=int, default=None, help="Exit when this process exits.")
    args = parser.parse_args()

    if args.parent_pid:
        exit_when_parent_exits(args.parent_pid)

    settings = get_settings()
    # A windowed (--noconsole) PyInstaller build has no stdout/stderr; uvicorn's logging would fail.
    if sys.stdout is None or sys.stderr is None:
        log_dir = settings.data_directory / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = open(log_dir / "backend.log", "a", encoding="utf-8", buffering=1)  # noqa: SIM115 - lives for the process
        sys.stdout = sys.stdout or log_file
        sys.stderr = sys.stderr or log_file
    # Host is validated to loopback by Settings; never bind to 0.0.0.0.
    uvicorn.run(app, host=settings.host, port=settings.port, log_level=settings.log_level.lower())


if __name__ == "__main__":
    main()
