@echo off
setlocal enabledelayedexpansion
title Dwell — Upgrade
color 0B

set REPO_URL=https://github.com/dmcslab/Dwell.git
set BRANCH=main
set ENV_FILE=backend\.env
set ENV_BACKUP=backend\.env.upgrade-backup

echo.
echo  =====================================================
echo     Dwell — Upgrade Check
echo  =====================================================
echo.

:: ── Pre-flight ────────────────────────────────────────────────────────────────
where docker >nul 2>&1
if %errorlevel% neq 0 ( echo  [ERROR] Docker not found. & pause & exit /b 1 )

where git >nul 2>&1
if %errorlevel% neq 0 ( echo  [ERROR] Git not found. & pause & exit /b 1 )

docker info >nul 2>&1
if %errorlevel% neq 0 ( echo  [ERROR] Docker is not running. Start Docker Desktop and try again. & pause & exit /b 1 )

if not exist "docker-compose.yml" (
    echo  [ERROR] Run this script from the Dwell repo root directory.
    pause & exit /b 1
)

docker compose version >nul 2>&1
if %errorlevel% equ 0 ( set COMPOSE=docker compose ) else ( set COMPOSE=docker-compose )

:: Ensure remote points to the correct repo
git remote set-url origin %REPO_URL% >nul 2>&1

:: ── Step 1: Check for remote updates ─────────────────────────────────────────
echo  [*] Checking for updates from %REPO_URL%...
git fetch origin %BRANCH% >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Could not reach GitHub. Check your internet connection.
    echo  [!] Your current installation is unchanged.
    pause & exit /b 0
)

for /f %%i in ('git rev-parse HEAD') do set LOCAL=%%i
for /f %%i in ('git rev-parse origin/%BRANCH%') do set REMOTE=%%i

if "%LOCAL%"=="%REMOTE%" (
    echo.
    echo  =====================================================
    echo     You are already on the latest version!
    echo     No upgrade needed.
    echo  =====================================================
    echo.
    pause & exit /b 0
)

echo.
echo  [*] Updates available:
git log HEAD..origin/%BRANCH% --oneline
echo.

:: ── Step 2: Back up .env ──────────────────────────────────────────────────────
if exist "%ENV_FILE%" (
    copy /y "%ENV_FILE%" "%ENV_BACKUP%" >nul
    echo  [OK] Backed up %ENV_FILE% to %ENV_BACKUP%
) else (
    echo  [!] No %ENV_FILE% found — skipping backup.
)

:: ── Step 3: Stop containers (volumes are never touched) ───────────────────────
echo  [*] Stopping containers ^(your data is preserved^)...
%COMPOSE% down
if %errorlevel% neq 0 ( echo  [ERROR] Failed to stop containers. & pause & exit /b 1 )
echo  [OK] Containers stopped.

:: ── Step 4: Pull updates ──────────────────────────────────────────────────────
echo  [*] Downloading updates...
git pull origin %BRANCH%
if %errorlevel% neq 0 ( echo  [ERROR] Git pull failed. & pause & exit /b 1 )
echo  [OK] Code updated.

:: ── Step 5: Restore .env if pull overwrote it ────────────────────────────────
if exist "%ENV_BACKUP%" (
    fc /b "%ENV_FILE%" "%ENV_BACKUP%" >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [!] .env was modified by the update — restoring your configuration.
        copy /y "%ENV_BACKUP%" "%ENV_FILE%" >nul
        echo  [OK] Your configuration restored.
    ) else (
        echo  [OK] .env unchanged — no restore needed.
    )
)

:: ── Step 6: Rebuild images and restart ───────────────────────────────────────
echo  [*] Rebuilding and restarting services...
%COMPOSE% up -d --build
if %errorlevel% neq 0 ( echo  [ERROR] Failed to restart services. & pause & exit /b 1 )
echo  [OK] Services restarted.

:: ── Step 7: Rebuild scenario-worker if Dockerfile or logic.py changed ─────────
echo  [*] Checking scenario-worker...
git diff HEAD~1 HEAD --name-only 2>nul | findstr /i "scenario-worker" >nul 2>&1
if %errorlevel% equ 0 (
    git diff HEAD~1 HEAD --name-only 2>nul | findstr /i "game/logic.py" >nul 2>&1
)
if %errorlevel% equ 0 (
    echo  [*] Scenario-worker files changed — rebuilding worker image...
    call build_worker.bat 2>nul || (
        echo  [!] build_worker.bat not found — run: docker build -f scenario-worker/Dockerfile -t dwell_scenario_worker:latest .
    )
) else (
    echo  [OK] Scenario-worker unchanged — skipping rebuild.
)

:: ── Done ──────────────────────────────────────────────────────────────────────
echo.
echo  =====================================================
echo     Upgrade complete!
echo     Open: http://localhost:5173
echo  =====================================================
echo.
echo  Backup kept at %ENV_BACKUP%
echo  Safe to delete once you have verified the app.
echo.
pause
