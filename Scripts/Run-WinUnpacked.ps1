#Requires -Version 5.1
# Run-WinUnpacked: rebuild dist / win-unpacked only when stale, then launch.
# Double-click via Run-WinUnpacked.bat. English-only (PS 5.1 encoding safety).
param([string]$Root = "")

$ErrorActionPreference = "Stop"

function Fail([string]$Message)
{
	Write-Host ""
	Write-Host ("FAILED: {0}" -f $Message) -ForegroundColor Red
	Write-Host "Window stays open so you can read the log. Press any key to close."
	pause | Out-Null
	exit 1
}

if ([string]::IsNullOrWhiteSpace($Root) -or -not (Test-Path -LiteralPath $Root))
{
	Fail "Repo root not found."
}
$Root = (Resolve-Path -LiteralPath $Root).Path
Set-Location -LiteralPath $Root

$distMain = Join-Path $Root "dist\main\Main.cjs"
$asar = Join-Path $Root "release\win-unpacked\resources\app.asar"
$exe = Join-Path $Root "release\win-unpacked\Scouter.exe"
$yml = Join-Path $Root "electron-builder.yml"

function NewestInputTime()
{
	$latest = [datetime]::MinValue
	$dirs = @("Source", "Plugins", "webpack", "Assets") | ForEach-Object { Join-Path $Root $_ }
	$files = @("package.json", "package-lock.json", "tsconfig.json", "tsconfig.base.json") | ForEach-Object { Join-Path $Root $_ }
	foreach ($file in $files)
	{
		if (Test-Path -LiteralPath $file)
		{
			$time = (Get-Item -LiteralPath $file).LastWriteTime
			if ($time -gt $latest)
			{
				$latest = $time
			}
		}
	}
	foreach ($dir in $dirs)
	{
		if (-not (Test-Path -LiteralPath $dir))
		{
			continue
		}
		$found = Get-ChildItem -LiteralPath $dir -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
			$_.FullName -notmatch "\\(node_modules|dist|release|\.git|coverage|\.cache)(\\|$)"
		}
		foreach ($item in $found)
		{
			if ($item.LastWriteTime -gt $latest)
			{
				$latest = $item.LastWriteTime
			}
		}
	}
	return $latest
}

function IsStale([string]$Target, [datetime]$Reference)
{
	if (-not (Test-Path -LiteralPath $Target))
	{
		return $true
	}
	$targetTime = (Get-Item -LiteralPath $Target).LastWriteTime
	return ($Reference - $targetTime).TotalSeconds -gt 2
}

try
{
	if ($null -eq (Get-Command npm -ErrorAction SilentlyContinue))
	{
		Fail "npm not found on PATH."
	}
	if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules\electron")))
	{
		Write-Host "node_modules missing. Running npm install..."
		& npm install
		if ($LASTEXITCODE -ne 0)
		{
			Fail "npm install failed."
		}
	}

	$inputTime = NewestInputTime
	if (IsStale $distMain $inputTime)
	{
		Write-Host "Sources changed. Building dist..."
		& npm run build
		if ($LASTEXITCODE -ne 0)
		{
			Fail "npm run build failed."
		}
		(Get-Item -LiteralPath $distMain).LastWriteTime = Get-Date
	}
	else
	{
		Write-Host "dist is up to date. Skipping build."
	}

	$distTime = (Get-Item -LiteralPath $distMain).LastWriteTime
	$ymlTime = (Get-Item -LiteralPath $yml).LastWriteTime
	$needPack = IsStale $asar $distTime
	if (-not $needPack)
	{
		$needPack = IsStale $asar $ymlTime
	}
	if (-not (Test-Path -LiteralPath $exe))
	{
		$needPack = $true
	}
	if ($needPack)
	{
		Write-Host "Packaging win-unpacked..."
		if ([string]::IsNullOrEmpty($env:SCOUTER_UPDATE_URL))
		{
			$env:SCOUTER_UPDATE_URL = "https://example.com/updates"
		}
		$backup = Join-Path ([System.IO.Path]::GetTempPath()) "electron-builder.yml.scouter-bak"
		Copy-Item -LiteralPath $yml -Destination $backup -Force
		try
		{
			$text = Get-Content -LiteralPath $yml -Raw
			if ($text -notmatch "signAndEditExecutable")
			{
				$text = $text.Replace("  icon: Assets/app.ico", "  icon: Assets/app.ico`r`n  signAndEditExecutable: false")
				Set-Content -LiteralPath $yml -Value $text -NoNewline
			}
			& npx electron-builder --win --x64 --dir
			if ($LASTEXITCODE -ne 0)
			{
				Fail "electron-builder --dir failed."
			}
		}
		finally
		{
			Copy-Item -LiteralPath $backup -Destination $yml -Force
		}
	}
	else
	{
		Write-Host "win-unpacked is up to date. Skipping pack."
	}

	if (-not (Test-Path -LiteralPath $exe))
	{
		Fail "Scouter.exe not found after pack."
	}
	Write-Host "Launching Scouter..."
	Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe) | Out-Null
}
catch
{
	Fail $_.Exception.Message
}
