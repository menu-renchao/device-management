@echo off
chcp 65001 >nul
title POS Scanner - Go 后端

echo ========================================
echo   POS Scanner - Go 后端服务
echo ========================================
echo.

:: 检查 Go 是否安装
where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Go 环境，请先安装 Go
    echo 下载地址: https://go.dev/dl/
    pause
    exit /b 1
)

:: 设置 Go 代理 (国内镜像)
go env -w GOPROXY=https://goproxy.cn,direct >nul 2>&1

cd /d "%~dp0backend-go"

echo 启动 Go 后端...
echo 地址: http://localhost:5000
echo.

go run cmd/server/main.go
