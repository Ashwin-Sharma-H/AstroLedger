@echo off
echo ===================================================
echo     Generating AstroLedger Android Icons & Splash
echo ===================================================
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0generate_android_icons.ps1"
echo.
pause
