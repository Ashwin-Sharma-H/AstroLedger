@echo off
echo ===================================================
echo     AstroLedger - Reset to Fresh First-Time State
echo ===================================================

echo [1/2] Closing any running instances...
taskkill /F /IM AstroLedger.exe /T 2>nul
taskkill /F /IM astroledger-server.exe /T 2>nul
taskkill /F /IM electron.exe /T 2>nul

echo [2/2] Wiping saved login sessions, tokens, and client database...
if exist "%APPDATA%\AstroLedger" (
    rmdir /s /q "%APPDATA%\AstroLedger"
    echo Removed: %APPDATA%\AstroLedger
)
if exist "%LOCALAPPDATA%\AstroLedger" (
    rmdir /s /q "%LOCALAPPDATA%\AstroLedger"
    echo Removed: %LOCALAPPDATA%\AstroLedger
)
if exist "%APPDATA%\astroledger-desktop" (
    rmdir /s /q "%APPDATA%\astroledger-desktop"
    echo Removed: %APPDATA%\astroledger-desktop
)
if exist "%LOCALAPPDATA%\astroledger-desktop" (
    rmdir /s /q "%LOCALAPPDATA%\astroledger-desktop"
    echo Removed: %LOCALAPPDATA%\astroledger-desktop
)

echo.
echo ===================================================
echo [SUCCESS] App reset to 100%% pristine first-time state!
echo Launching AstroLedger to test...
echo ===================================================
start "" "desktop\release\AstroLedger 1.0.0.exe"
pause
