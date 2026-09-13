@echo off
rem Double-click entry: always rebuild dist.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Scripts\BuildIfStale.ps1" -Root "%~dp0." -Force
