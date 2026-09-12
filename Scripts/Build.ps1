#Requires -Version 5.1
param()
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot/.."
npm ci
if ($?) { npm run lint }
if ($?) { npm run typecheck }
if ($?) { npm run build }
if ($?) { npm run test:unit }
