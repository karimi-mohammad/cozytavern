@echo off
cd /d "%~dp0"

echo.
echo ====================================
echo   CozyTavern - AI Chat Frontend
echo ====================================
echo.

REM Install server dependencies if needed
if not exist "server\node_modules" (
    echo [1/3] Installing server dependencies...
    cd server && call npm install --production && cd ..
)

REM Install client dependencies if needed
if not exist "client\node_modules" (
    echo [2/3] Installing client dependencies...
    cd client && call npm install && cd ..
)

echo [3/3] Starting server...
echo.
echo   Open http://localhost:3002 in your browser
echo   Press Ctrl+C to stop
echo.
cd server && node dist\index.js

pause
