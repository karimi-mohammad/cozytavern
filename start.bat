@echo off
cd /d "%~dp0"

echo.
echo ====================================
echo   CozyTavern - AI Chat Frontend
echo ====================================
echo.

REM ── Step 1: Check build status ───────────────────────────────────────
echo [1/5] Checking build status...
echo.
node check-build.js
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to check build status. Running full build...
)

REM ── Step 2: Install server dependencies ──────────────────────────────
if not exist "server\node_modules" (
    echo [2/5] Installing server dependencies...
    cd server && call npm install && cd ..
    if errorlevel 1 (
        echo [ERROR] Server npm install failed!
        pause
        exit /b 1
    )
) else (
    echo [2/5] Server dependencies already installed.
)

REM ── Step 3: Install client dependencies ──────────────────────────────
if not exist "client\node_modules" (
    echo [3/5] Installing client dependencies...
    cd client && call npm install && cd ..
    if errorlevel 1 (
        echo [ERROR] Client npm install failed!
        pause
        exit /b 1
    )
) else (
    echo [3/5] Client dependencies already installed.
)

REM ── Step 4: Smart build ─────────────────────────────────────────────
echo [4/5] Building changed components...
call node smart-build.js
if errorlevel 1 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

REM ── Step 5: Start server ─────────────────────────────────────────────
echo.
echo [5/5] Starting server...
if not exist "server\dist\index.js" (
    echo [FATAL] server\dist\index.js not found after build!
    echo         Something went wrong with the build. Check errors above.
    pause
    exit /b 1
)

echo.
echo   Open http://localhost:3002 in your browser
echo   Press Ctrl+C to stop
echo.
cd server && node dist\index.js

pause
