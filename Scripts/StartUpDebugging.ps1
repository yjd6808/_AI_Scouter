#Requires -Version 5.1
param([switch]$Test, [switch]$Hidden, [string]$LayoutDir = "Source/Scouter.App/Renderer/Layout")
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."
npm run build
$flags = @("--no-auth", "--layout-dir", $LayoutDir)
if ($Test)   { $flags += "--test" }
if ($Hidden) { $flags += "--hidden" }
npx electron dist/main/Main.cjs @flags
