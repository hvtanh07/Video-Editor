@echo off
title Video Editor Studio
echo ========================================================
echo               VIDEO EDITOR STUDIO
echo      Cut - Crop Ratio - Speed (0.25x-4x) - Volume
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [1/3] Installing dependencies...
    call npm install
)

if not exist "docs" (
    echo [2/3] Building frontend assets into docs/...
    call npm run build
)

echo [3/3] Starting Video Editor Server...
echo.
echo Opening Video Editor in your browser at http://localhost:5000
echo Press Ctrl+C in this window to stop the server anytime.
echo.

start http://localhost:5000
node server/index.js
pause
