@echo off
chcp 65001 >nul
title POS Scanner - Frontend

echo ========================================
echo   POS Scanner - React Frontend Service
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found. Please install Node.js first.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

cd /d "%~dp0frontend"

if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo Building frontend for production preview...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)

echo Starting frontend production preview...
echo URL: http://localhost:3000
echo.

call npm run preview:prod
