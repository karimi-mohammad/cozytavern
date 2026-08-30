@echo off
cd /d "%~dp0"

echo.
echo ====================================
echo   CozyTavern - AI Chat Frontend
echo ====================================
echo.

REM Install dependencies if needed
if not exist "server\node_modules" (
    echo [1/4] Installing server dependencies...
    cd server && call npm install && cd ..
)

if not exist "client\node_modules" (
    echo [2/4] Installing client dependencies...
    cd client && call npm install && cd ..
)

REM Build server if needed
if not exist "server\dist\index.js" (
    echo [3/4] Building server...
    cd server && call npm run build && cd ..
)

REM Build client if needed
if not exist "client\dist\index.html" (
    echo [4/4] Building client...
    cd client && call npm run build && cd ..
)

echo.
echo Starting server...
echo.
echo   Open http://localhost:3002 in your browser
echo   Press Ctrl+C to stop
echo.
cd server && node dist\index.js

pause
