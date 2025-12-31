param([switch]$Reset)

$ErrorActionPreference = "Stop"

# Move to backend/ no matter where the script is called from
Set-Location (Split-Path $PSScriptRoot -Parent)  # -> backend

# Always use THIS project's venv python (prevents random PyCharmMiscProject venv issues)
$PY = ".\.venv\Scripts\python.exe"

if (-not (Test-Path $PY)) {
  Write-Host "ERROR: backend\.venv not found. Create it first:" -ForegroundColor Red
  Write-Host "  python -m venv .venv" -ForegroundColor Yellow
  Write-Host "  .\.venv\Scripts\Activate.ps1" -ForegroundColor Yellow
  Write-Host "  pip install -r requirements.txt" -ForegroundColor Yellow
  exit 1
}

if ($Reset) {
  Remove-Item .\data\app.db -Force -ErrorAction SilentlyContinue
  Remove-Item .\data\uploads -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item .\data\processed -Recurse -Force -ErrorAction SilentlyContinue
}

# Ensure data dirs exist
New-Item -ItemType Directory -Path .\data\uploads -Force | Out-Null
New-Item -ItemType Directory -Path .\data\processed -Force | Out-Null

# Install deps (idempotent)
& $PY -m pip install -r requirements.txt

# Run migrations (STOP if fails, don't start server on broken DB)
& $PY -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Alembic migration failed. Server will NOT start." -ForegroundColor Red
  exit $LASTEXITCODE
}

# Start API (src is import root)
& $PY -m uvicorn ai_organizer.main:app --reload --app-dir src --host 127.0.0.1 --port 8000
