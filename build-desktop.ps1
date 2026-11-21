# Builds the installable desktop app: backend sidecar first, then the Tauri bundle.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Native tools (pip, PyInstaller, cargo) log to stderr. With "Stop", Windows PowerShell turns those lines
# into terminating errors whenever output is redirected (CI, logs), so rely on $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"

& (Join-Path $root "desktop\build-backend.ps1")

Set-Location (Join-Path $root "desktop\tauri")
# The bundle config adds the sidecar (externalBin); plain `tauri dev` does not need it.
& (Join-Path $root "frontend\node_modules\.bin\tauri.cmd") build --config tauri.bundle.conf.json
if ($LASTEXITCODE -ne 0) { throw "tauri build failed." }

# Copy the setup into releases\<version>\ so it is easy to find.
$version = (Get-Content (Join-Path $root "desktop\tauri\tauri.conf.json") -Raw | ConvertFrom-Json).version
$releaseDir = Join-Path $root "releases\$version"
New-Item -ItemType Directory -Force $releaseDir | Out-Null
Copy-Item (Join-Path $root "desktop\tauri\target\release\bundle\nsis\Clario_${version}_x64-setup.exe") $releaseDir -Force
Write-Host "Setup copied to $releaseDir"
