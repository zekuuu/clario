# Builds the FastAPI backend into a single executable for the Tauri sidecar.
# Output: desktop/tauri/binaries/clario-backend-<target-triple>.exe (the name Tauri's externalBin expects).
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backendDir = Join-Path $root "backend"
$python = Join-Path $backendDir ".venv\Scripts\python.exe"
$binDir = Join-Path $root "desktop\tauri\binaries"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Backend virtual environment not found. Follow the README Getting Started steps first."
}

# Native tools (pip, PyInstaller, cargo) log to stderr. With "Stop", Windows PowerShell turns those lines
# into terminating errors whenever output is redirected (CI, logs), so rely on $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"

& $python -m pip install --quiet -r (Join-Path $backendDir "requirements-build.txt")
if ($LASTEXITCODE -ne 0) { throw "Installing build requirements failed." }

$triple = (& rustc -vV | Select-String "^host:").ToString().Split(" ")[1].Trim()
$name = "clario-backend-$triple"
$workDir = Join-Path $backendDir "build\pyinstaller"

Push-Location $backendDir
try {
    & $python -m PyInstaller run_server.py `
        --name $name `
        --onefile `
        --noconsole `
        --clean `
        --noconfirm `
        --distpath $binDir `
        --workpath $workDir `
        --specpath $workDir `
        --collect-submodules uvicorn `
        --collect-data reportlab `
        --hidden-import openpyxl `
        --hidden-import xlrd `
        --exclude-module pytest
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed." }
}
finally {
    Pop-Location
}

Write-Host "Built $(Join-Path $binDir "$name.exe")"
