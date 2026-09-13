@echo off
rem Double-click entry: deploy win-unpacked when stale, then run it.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Scripts\Run-WinUnpacked.ps1" -Root "%~dp0."
