#!/bin/bash
echo ""
echo "===================================="
echo "  CozyTavern - AI Chat Frontend"
echo "===================================="
echo ""

# Install server dependencies if needed
if [ ! -d "server/node_modules" ]; then
    echo "[1/4] Installing server dependencies..."
    cd server && npm install && cd ..
fi

# Install client dependencies if needed
if [ ! -d "client/node_modules" ]; then
    echo "[2/4] Installing client dependencies..."
    cd client && npm install && cd ..
fi

# Build server if needed
if [ ! -f "server/dist/index.js" ]; then
    echo "[3/4] Building server..."
    cd server && npm run build && cd ..
fi

# Build client if needed
if [ ! -f "client/dist/index.html" ]; then
    echo "[4/4] Building client..."
    cd client && npm run build && cd ..
fi

echo ""
echo "Starting server..."
echo ""
echo "Open http://localhost:3002 in your browser"
echo "Press Ctrl+C to stop"
echo ""
cd server && node dist/index.js
