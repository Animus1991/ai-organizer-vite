# Quick development server script
# Usage: .\run_dev.ps1

$ErrorActionPreference = "Stop"

# Move to backend/ no matter where the script is called from
$BackendDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD }
Set-Location $BackendDir

# Check if virtual environment exists
$PY = ".\.venv\Scripts\python.exe"
if (Test-Path $PY) {
  Write-Host "Using virtual environment: .venv" -ForegroundColor Green
  $PythonCmd = $PY
} else {
  Write-Host "No virtual environment found, using system Python" -ForegroundColor Yellow
  $PythonCmd = "python"
}

# Set PYTHONPATH to src (so ai_organizer can be imported)
$env:PYTHONPATH = "src"

Write-Host "Starting backend server..." -ForegroundColor Green
Write-Host "  Backend will be available at: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  API docs: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "" 

# Start uvicorn with correct app-dir
& $PythonCmd -m uvicorn ai_organizer.main:app --reload --app-dir src --host 127.0.0.1 --port 8000
