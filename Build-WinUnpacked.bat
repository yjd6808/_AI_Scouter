@echo off
rem Double-click entry: ensure fresh dist, then package win-unpacked. No launch.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Scripts\Build-WinUnpacked.ps1" -Root "%~dp0."
