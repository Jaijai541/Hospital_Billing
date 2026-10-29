@echo off
title Hospital Billing Real-Time WebSocket Server (Port 8085)
cd /d "%~dp0"
echo Starting Hospital Billing Native PHP WebSocket Server on port 8085...
if exist "C:\xampp\php\php.exe" (
    "C:\xampp\php\php.exe" "api\ws_server.php" 8085
) else (
    php "api\ws_server.php" 8085
)
pause
