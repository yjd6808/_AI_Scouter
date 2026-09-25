#Requires -Version 5.1
# BuildCommon: shared build/pack helpers. Dot-source only, no top-level work.
# English-only (PS 5.1 encoding safety).

function Fail([string]$Message)
{
	Write-Host ""
	Write-Host ("FAILED: {0}" -f $Message) -ForegroundColor Red
	Write-Host "Window stays open so you can read the log. Press any key to close."
	pause | Out-Null
	exit 1
}

function Get-RepoRoot([string]$Root)
{
	if ([string]::IsNullOrWhiteSpace($Root) -or -not (Test-Path -LiteralPath $Root))
	{
		Fail "Repo root not found."
	}
	return (Resolve-Path -LiteralPath $Root).Path
}

function Get-NewestInputTime([string]$Root)
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

function Test-Stale([string]$Target, [datetime]$Reference)
{
	if (-not (Test-Path -LiteralPath $Target))
	{
		return $true
	}
	$targetTime = (Get-Item -LiteralPath $Target).LastWriteTime
	return ($Reference - $targetTime).TotalSeconds -gt 2
}

function Install-NodeModules([string]$Root)
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
}

function Build-DistIfStale([string]$Root, [switch]$Force)
{
	$distMain = Join-Path $Root "dist\main\Main.cjs"
	$stale = $Force
	if (-not $stale)
	{
		# NOTE: only Main.cjs is the freshness marker. Renderer html may keep its
		# timestamp when webpack output is identical, so it must not gate the check.
		$stale = Test-Stale $distMain (Get-NewestInputTime $Root)
	}
	if ($stale)
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
}

function Pack-WinUnpacked([string]$Root)
{
	$distMain = Join-Path $Root "dist\main\Main.cjs"
	$asar = Join-Path $Root "release\win-unpacked\resources\app.asar"
	$exe = Join-Path $Root "release\win-unpacked\Scouter.exe"
	$yml = Join-Path $Root "electron-builder.yml"
	$distTime = (Get-Item -LiteralPath $distMain).LastWriteTime
	$ymlTime = (Get-Item -LiteralPath $yml).LastWriteTime
	$needPack = Test-Stale $asar $distTime
	if (-not $needPack)
	{
		$needPack = Test-Stale $asar $ymlTime
	}
	if (-not $needPack)
	{
		# 플러그인은 소스(.ts) 그대로 패키징되므로 dist를 거치지 않는다. 입력 변경도 감지.
		$needPack = Test-Stale $asar (Get-NewestInputTime $Root)
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
		# electron-builder가 appOutDir를 비우므로 기존 Plugins를 백업했다가
		# 팩에 없는 항목(수동 배치 등)만 복원한다.
		$pluginsDir = Join-Path $Root "release\win-unpacked\resources\Plugins"
		$pluginsBak = Join-Path ([System.IO.Path]::GetTempPath()) "scouter-plugins-bak"
		if (Test-Path -LiteralPath $pluginsDir)
		{
			if (Test-Path -LiteralPath $pluginsBak)
			{
				Remove-Item -LiteralPath $pluginsBak -Recurse -Force
			}
			Copy-Item -LiteralPath $pluginsDir -Destination $pluginsBak -Recurse -Force
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
		if ((Test-Path -LiteralPath $pluginsBak) -and (Test-Path -LiteralPath $pluginsDir))
		{
			foreach ($item in (Get-ChildItem -LiteralPath $pluginsBak -Force))
			{
				$dest = Join-Path $pluginsDir $item.Name
				if (-not (Test-Path -LiteralPath $dest))
				{
					Copy-Item -LiteralPath $item.FullName -Destination $dest -Recurse -Force
				}
			}
			Remove-Item -LiteralPath $pluginsBak -Recurse -Force
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
	return $exe
}
