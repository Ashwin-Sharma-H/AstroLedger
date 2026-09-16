@echo off
echo ===================================================
echo     AstroLedger Desktop Rebuild & Launch Tool
echo ===================================================

echo [1/3] Closing any stuck background processes...
taskkill /F /IM AstroLedger.exe /T 2>nul
taskkill /F /IM astroledger-server.exe /T 2>nul
taskkill /F /IM electron.exe /T 2>nul

echo [2/3] Building new desktop installer and package...
call npm run build:desktop

echo [3/3] Launching newly built AstroLedger...
start "" "desktop\release\AstroLedger 1.0.0.exe"

echo ===================================================
echo [DONE] AstroLedger is now launching on your screen!
echo New Setup installer: desktop\release\AstroLedger Setup 1.0.0.exe
echo ===================================================
pause
