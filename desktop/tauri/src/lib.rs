use std::net::{SocketAddr, TcpStream};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent};

/// Must match the backend default port, the frontend API URL, and the CSP `connect-src`.
const BACKEND_ADDR: &str = "127.0.0.1:8766";
// A cold one-file start (unpack + antivirus scan of a fresh build) measured ~40s; warm starts take ~6-9s.
const BACKEND_START_TIMEOUT: Duration = Duration::from_secs(60);
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// The sidecar process this app started (None in dev, or when a backend was already running).
struct Backend(Mutex<Option<Child>>);

fn backend_ready() -> bool {
    let addr: SocketAddr = BACKEND_ADDR.parse().expect("valid backend address");
    // uvicorn only accepts connections once the app has finished starting up.
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

/// Tauri copies `externalBin` sidecars next to the main executable without the target-triple suffix.
fn spawn_backend() -> std::io::Result<Child> {
    let exe = std::env::current_exe()?;
    let dir = exe
        .parent()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "executable has no parent directory"))?;
    let binary = dir.join(if cfg!(windows) { "clario-backend.exe" } else { "clario-backend" });

    let mut command = Command::new(binary);
    // The backend exits on its own if this process dies without running the exit handler.
    command.arg("--parent-pid").arg(std::process::id().to_string());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command.spawn()
}

/// A PyInstaller one-file build runs as a bootloader plus a child interpreter, so kill the whole tree.
fn stop_backend(child: &mut Child) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(Backend(Mutex::new(None)))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
                window.set_icon(icon)?;
            }

            // In development run-dev.ps1 owns the backend (with --reload); only release builds start the sidecar.
            if !cfg!(debug_assertions) && !backend_ready() {
                match spawn_backend() {
                    Ok(child) => *app.state::<Backend>().0.lock().expect("backend state") = Some(child),
                    Err(error) => eprintln!("failed to start the Clario backend: {error}"),
                }
            }

            // Show the window once the API answers, so the first screen doesn't flash a connection error.
            // It is shown anyway after the timeout; the UI then reports the backend as unreachable.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let started = Instant::now();
                while !backend_ready() && started.elapsed() < BACKEND_START_TIMEOUT {
                    std::thread::sleep(Duration::from_millis(200));
                }
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build desktop application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            let child = app_handle.state::<Backend>().0.lock().ok().and_then(|mut guard| guard.take());
            if let Some(mut child) = child {
                stop_backend(&mut child);
            }
        }
    });
}
