@echo off
:: Batch script to allow inbound TCP traffic on port 8000 for AstroLedger Server
echo ===================================================
echo     AstroLedger Windows Firewall Configuration
echo ===================================================
echo.
echo Checking administrator privileges...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Administrator privileges required.
    echo Please right-click this file and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo [*] Adding Inbound Firewall Rule for AstroLedger (Port 8000 TCP)...
netsh advfirewall firewall delete rule name="AstroLedger Server (Port 8000)" >nul 2>&1
netsh advfirewall firewall add rule name="AstroLedger Server (Port 8000)" dir=in action=allow protocol=TCP localport=8000 profile=any

if %errorLevel% equ 0 (
    echo.
    echo [SUCCESS] Windows Firewall rule added successfully!
    echo Mobile devices on your Wi-Fi network can now connect to http://^<PC_IP^>:8000.
) else (
    echo.
    echo [ERROR] Failed to add firewall rule. Error code: %errorLevel%
)

echo.
pause
