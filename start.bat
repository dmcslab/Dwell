@echo off
title Dwell IR Training Platform
color 0B

echo.
echo  =====================================================
echo     Dwell IR Training Platform  by dMCSlab
echo  =====================================================
echo.

:: Check Docker
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Docker is not installed.
    echo  Download it from: https://docs.docker.com/get-docker/
    pause & exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Docker is not running.
    echo  Please start Docker Desktop and try again.
    pause & exit /b 1
)

echo  [OK] Docker is running
echo.

:: Try docker compose v2 first
docker compose version >nul 2>&1
if %errorlevel% equ 0 (
    set COMPOSE=docker compose
) else (
    docker-compose version >nul 2>&1
    if %errorlevel% equ 0 (
        set COMPOSE=docker-compose
    ) else (
        echo  [ERROR] docker compose not found. Update Docker Desktop.
        pause & exit /b 1
    )
)

echo  [*] Building images (first run takes ~2 minutes)...
%COMPOSE% build --quiet
if %errorlevel% neq 0 ( echo  [ERROR] Build failed. & pause & exit /b 1 )

echo  [*] Starting services...
%COMPOSE% up -d
if %errorlevel% neq 0 ( echo  [ERROR] Start failed. & pause & exit /b 1 )

echo  [*] Waiting for app to be ready...
timeout /t 15 /nobreak >nul

echo.
echo  =====================================================
echo    Application is running!
echo  =====================================================
echo.
echo    Open in browser:
echo    ^>^>  http://localhost:5173
echo.
echo    Default admin login:
echo    User:  admin
echo    Pass:  Dwell!Change123
echo.
echo    To stop: run stop.bat
echo  =====================================================
echo.
start http://localhost:5173
pause
