@echo off
cd /d "%~dp0"

echo ================================
echo   CozyTavern - Starting...
echo ================================

REM Install dependencies if needed
if not exist "node_modules" (
    echo [!] Installing dependencies...
    call npm run install:all
)

echo.
echo Starting server and client...
echo.

call npm run dev

pause
