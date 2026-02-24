@echo off
chcp 65001 >nul
title POS Scanner - 前端

echo ========================================
echo   POS Scanner - React 前端服务
echo ========================================
echo.

:: 检查 Node 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

cd /d "%~dp0frontend"

echo 启动 React 前端...
echo 地址: http://localhost:3000
echo.

npm run dev
