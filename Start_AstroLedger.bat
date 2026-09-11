@echo off
title AstroLedger Launcher
cd /d "%~dp0"

echo ===================================================
echo             Starting AstroLedger...
echo ===================================================

:: 1. Detect Python / Virtual Environment
if exist "venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

:: 2. Check if backend is already active on port 8000
curl -s http://127.0.0.1:8000/api/health/ >nul 2>&1
if %errorlevel% equ 0 (
    echo [*] Backend engine is already running.
) else (
    echo [*] Starting background server...
    start /min "" "%PYTHON_EXE%" backend\manage.py runserver 0.0.0.0:8000
    :: Wait 2 seconds for server boot
    timeout /t 2 /nobreak >nul
)

:: 3. Launch Application
if exist "desktop\node_modules\electron" (
    echo [*] Launching Desktop Application...
    cd desktop
    npm start
) else (
    echo [*] Launching Web Interface in default browser...
    start "" http://localhost:5173
)

exit
