@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\.bin\electron.cmd" (
    echo [Run] electron not found. Running npm install...
    call npm install
    if errorlevel 1 (
        echo [Run] npm install failed.
        exit /b 1
    )
)

if /i "%~1"=="rebuild" goto :forcebuild

echo [Run] Checking build state...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Scripts\BuildIfStale.ps1" -Root "%~dp0."
if errorlevel 1 (
    echo [Run] build failed.
    exit /b 1
)
goto :run

:forcebuild
echo [Run] Rebuilding...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Scripts\BuildIfStale.ps1" -Root "%~dp0." -Force
if errorlevel 1 (
    echo [Run] build failed.
    exit /b 1
)
shift

:run
echo [Run] Starting Scouter...
call node_modules\.bin\electron.cmd "dist\main\Main.cjs" %*
