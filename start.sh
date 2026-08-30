#!/bin/bash
set -e
cd "$(dirname "$0")"

echo ""
echo "===================================="
echo "  CozyTavern - AI Chat Frontend"
echo "===================================="
echo ""

# ── Step 1: Check build status ───────────────────────────────────────
echo "[1/5] Checking build status..."
echo ""
node check-build.js

# ── Step 2: Install server dependencies ──────────────────────────────
if [ ! -d "server/node_modules" ]; then
    echo "[2/5] Installing server dependencies..."
    cd server && npm install && cd ..
else
    echo "[2/5] Server dependencies already installed."
fi

# ── Step 3: Install client dependencies ──────────────────────────────
if [ ! -d "client/node_modules" ]; then
    echo "[3/5] Installing client dependencies..."
    cd client && npm install && cd ..
else
    echo "[3/5] Client dependencies already installed."
fi

# ── Step 4: Smart build ─────────────────────────────────────────────
echo "[4/5] Building changed components..."
node smart-build.js

# ── Step 5: Start server ─────────────────────────────────────────────
echo ""
echo "[5/5] Starting server..."
if [ ! -f "server/dist/index.js" ]; then
    echo "[FATAL] server/dist/index.js not found after build!"
    echo "        Something went wrong with the build. Check errors above."
    exit 1
fi

echo ""
echo "  Open http://localhost:3002 in your browser"
echo "  Press Ctrl+C to stop"
echo ""
cd server && node dist/index.js
