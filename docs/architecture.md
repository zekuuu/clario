# Architecture

## Desktop and frontend

Tauri hosts a Vite-built React single-page application. Pages compose reusable components; feature logic belongs under `frontend/src/features`, network calls under `services`, and cross-page types under `types`. Core validation must never run in React.

In release builds the Tauri shell launches the PyInstaller-built backend as a sidecar (`desktop/tauri/src/lib.rs`), waits for `/health` before showing the window, and kills the process tree on exit. The backend is started with `--parent-pid` and exits if the shell dies. In development `run-dev.ps1` runs the backend with `--reload` instead.

Tauri starts with only `core:default` permissions. The content security policy permits the packaged UI and the loopback backend. File-system or dialog permissions should be added only when a concrete workflow requires them.

## Backend

FastAPI is the local transport boundary. Routes validate/translate HTTP data and delegate to services. Services orchestrate use cases, validators own one rule each, extractors own input formats, and repositories are the only modules that access SQLite.

The intended validation pipeline is:

```text
safe file intake -> sheet detection -> user-confirmed row setup -> row extraction
-> conservative normalization -> user preview -> comparison context
-> validator list -> immutable validation result -> report preparation -> output adapter
```

Report generators consume a completed result and cannot trigger validation. AI providers are optional advisory adapters and cannot mutate results.

## Local data and trust boundaries

- The API binds only to `127.0.0.1`/`localhost`.
- Uploads are checked for extension, file signature, count, and size before parsing.
- The API only answers requests whose Host is `127.0.0.1`/`localhost` (DNS-rebinding guard), only grants CORS to the Tauri and Vite origins, and rejects cross-site writes by `Origin`.
- User-controlled workbook values are treated as plain data, never executable content.
- SQLite stores session and report metadata. Working copies of uploads live under the data directory, never in place of the originals.
- The data directory is `<install folder>\data` for packaged builds (computed from the sidecar's own location in `app/config/settings.py`) and `backend/data/` when running from source. Paths saved in the DB and `session.json` are relative to it, so the folder can be moved. `app/services/legacy_data_service.py` imports pre-installer `~/.clario` data once, on the user's choice.
- Original source files are never overwritten.
- Internal paths and exception details must not be returned to the UI.

