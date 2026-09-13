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

if /i "%~1"=="rebuild" goto :build

if not exist "dist\main\Main.cjs" goto :build
if not exist "dist\renderer\Index.html" goto :build
goto :run

:build
echo [Run] Building...
call npm run build
if errorlevel 1 (
    echo [Run] build failed.
    exit /b 1
)
if /i "%~1"=="rebuild" shift

:run
echo [Run] Starting Scouter...
call node_modules\.bin\electron.cmd "dist\main\Main.cjs" %*
