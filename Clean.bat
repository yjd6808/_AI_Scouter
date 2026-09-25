@echo off
rem Scouter Clean - webpack dist + electron-builder release + npm workspaces node_modules + caches.
rem KEEP (never delete): Source/*/Renderer, Source/*/*.ts, Plugins/*/Layout, Assets, Docs, *.json, *.yml
setlocal
set "P=%~dp0"
rmdir /s /q "%P%dist" 2>nul
rmdir /s /q "%P%release" 2>nul
rmdir /s /q "%P%node_modules" 2>nul
rmdir /s /q "%P%coverage" 2>nul
for /d %%d in ("%P%Source\*") do (
  if exist "%%d\dist" rmdir /s /q "%%d\dist" 2>nul
  if exist "%%d\.cache" rmdir /s /q "%%d\.cache" 2>nul
)
for /d %%d in ("%P%Plugins\*") do (
  if exist "%%d\node_modules" rmdir /s /q "%%d\node_modules" 2>nul
  if exist "%%d\dist" rmdir /s /q "%%d\dist" 2>nul
  if exist "%%d\.cache" rmdir /s /q "%%d\.cache" 2>nul
)
del /s /q "%P%*.tsbuildinfo" 2>nul
for /d /r "%P%" %%d in (__pycache__ .pytest_cache) do @if exist "%%d" rd /s /q "%%d" 2>nul
echo CLEAN OK: %P% (dist/release/node_modules/caches removed, sources kept)
exit /b 0
