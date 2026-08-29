#!/bin/bash
echo ""
echo "===================================="
echo "  CozyTavern - AI Chat Frontend"
echo "===================================="
echo ""

# Check if node_modules exists
if [ ! -d "server/node_modules" ]; then
    echo "[1/3] Installing server dependencies..."
    cd server && npm install --production && cd ..
fi

if [ ! -d "client/node_modules" ]; then
    echo "[2/3] Installing client dependencies..."
    cd client && npm install && cd ..
fi

echo "[3/3] Starting server..."
echo ""
echo "Open http://localhost:3002 in your browser"
echo "Press Ctrl+C to stop"
echo ""
cd server && node dist/index.js
