#Requires -Version 5.1
# BuildIfStale: rebuild dist when stale (always with -Force). No launch, no pack.
# Used by Run.bat (if-stale) and Build.bat (-Force). English-only (PS 5.1 encoding safety).
param([string]$Root = "", [switch]$Force)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\BuildCommon.ps1"

try
{
	$Root = Get-RepoRoot $Root
	Set-Location -LiteralPath $Root
	Install-NodeModules $Root
	if ($Force)
	{
		Build-DistIfStale $Root -Force
	}
	else
	{
		Build-DistIfStale $Root
	}
}
catch
{
	Fail $_.Exception.Message
}
