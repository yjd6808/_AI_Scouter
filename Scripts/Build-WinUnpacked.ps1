#Requires -Version 5.1
# Build-WinUnpacked: ensure fresh dist, then package win-unpacked (--dir). No launch.
# Double-click via Build-WinUnpacked.bat. English-only (PS 5.1 encoding safety).
param([string]$Root = "")

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\BuildCommon.ps1"

try
{
	$Root = Get-RepoRoot $Root
	Set-Location -LiteralPath $Root
	Install-NodeModules $Root
	Build-DistIfStale $Root
	$exe = Pack-WinUnpacked $Root
	Write-Host ("Done: {0}" -f $exe)
}
catch
{
	Fail $_.Exception.Message
}
