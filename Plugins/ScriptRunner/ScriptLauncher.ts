/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScriptLauncher. 스크립트 1회 실행·중지·출력 읽기 담당.
	      Shell.Exec는 Windows에서 cmd.exe를 거치므로 중지 신호(Signal)만으로는 cmd.exe만 죽고
	      실제 스크립트는 계속 돈다. 그래서 PowerShell 래퍼가 자기 PID를 파일에 적고, 중지할 때
	      taskkill /T로 래퍼 아래 프로세스 트리를 통째로 끝낸다. PID 파일에는 실행 토큰을 함께 적어
	      옛 실행의 PID(이미 다른 프로세스가 재사용했을 수 있다)를 죽이는 일을 막는다.
	      빈 인자는 .ps1이면 빈 문자열 그대로, 그 밖(네이티브)이면 '""'로 넘긴다. PowerShell 5.1은 네이티브 명령에
	      빈 문자열 인자를 빼고 넘기므로 그대로 두면 뒤 인자가 앞으로 밀린다.
	      경로·인자는 명령줄이 아니라 환경 변수로 넘긴다. 한글 경로를 명령줄에 넣으면 실패하는 환경이 있고,
	      cmd.exe 명령줄 길이 상한(8191자)도 피할 수 있다. 출력은 stdout이 아니라 실행마다 덮어쓰는
	      로그 파일(UTF-8)에 쓴다. 실행 중에도 읽을 수 있고, 출력이 많아도 Exec 출력 상한에 걸려 죽지 않는다.
*/

import type { ILaunchRequest, ILaunchResult, ILauncherOptions, IScriptLauncher, IShellExec, ITextFs } from "./Types";

const kPowerShell = "powershell";
const kExecOutputBytes = 1024 * 1024;
const kKillTimeoutMs = 15000;

// 래퍼 본문. TS 템플릿 문자열이라 PowerShell 백틱과 "${"를 쓰지 않는다.
// 출력 줄은 [Console] 인코딩을 거치지 않고 UTF-8 StreamWriter로 직접 쓴다.
// 네이티브 프로그램 출력은 기본 콘솔 코드 페이지로 해석하고, .py·.js만 UTF-8로 해석한다.
const kWrapperScript = `$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$enc = New-Object System.Text.UTF8Encoding $false
foreach ($f in @($env:SR_LOG, $env:SR_PID)) { $d = [IO.Path]::GetDirectoryName($f); if (-not [IO.Directory]::Exists($d)) { [void][IO.Directory]::CreateDirectory($d) } }
[IO.File]::WriteAllText($env:SR_PID, "$PID|$env:SR_TOKEN", $enc)
$sw = New-Object IO.StreamWriter($env:SR_LOG, $false, $enc)
$sw.AutoFlush = $true
$script:left = [long]$env:SR_MAXLOG
function Write-SrLine([string]$s) {
	if ($script:left -lt 0) { return }
	$script:left -= ($s.Length + 2)
	if ($script:left -lt 0) { $sw.WriteLine('[ScriptRunner] 출력이 기록 상한을 넘어 이후 출력은 기록하지 않습니다.'); return }
	$sw.WriteLine($s)
}
function Write-SrObject($o) {
	if ($o -is [string]) { Write-SrLine $o }
	elseif ($o -is [Management.Automation.ErrorRecord] -or $o -is [Management.Automation.InformationRecord]) { Write-SrLine $o.ToString() }
	else { $o | Out-String -Stream -Width 240 | ForEach-Object { Write-SrLine $_ } }
}
$code = 0
try {
	$p = $env:SR_PATH
	$a = @()
	for ($k = 0; $k -lt [int]$env:SR_ARGC; $k++) { $v = [Environment]::GetEnvironmentVariable("SR_ARG$k"); if ($null -eq $v) { $v = '' }; $a += $v }
	if (-not [IO.File]::Exists($p)) { Write-SrLine "[ScriptRunner] 스크립트 파일이 없습니다: $p"; $code = 2 }
	else {
		Set-Location -LiteralPath ([IO.Path]::GetDirectoryName($p))
		$x = [IO.Path]::GetExtension($p).ToLowerInvariant()
		if ($x -ne '.ps1') { $a = @($a | ForEach-Object { if ($_.Length -eq 0) { '""' } else { $_ } }) }
		$global:LASTEXITCODE = 0
		if ($x -eq '.py') { $env:PYTHONIOENCODING = 'utf-8'; try { [Console]::OutputEncoding = $enc } catch {}; & $env:SR_PY $p @a *>&1 | ForEach-Object { Write-SrObject $_ } }
		elseif ($x -eq '.js') { try { [Console]::OutputEncoding = $enc } catch {}; & $env:SR_NODE $p @a *>&1 | ForEach-Object { Write-SrObject $_ } }
		else { & $p @a *>&1 | ForEach-Object { Write-SrObject $_ } }
		$code = $global:LASTEXITCODE
		if ($null -eq $code) { $code = 0 }
	}
}
catch { Write-SrLine "[ScriptRunner] $($_.Exception.Message)"; $code = 1 }
finally { $sw.Dispose() }
exit $code
`;

// 중지 본문. PID 파일의 토큰이 이번 실행과 같을 때만 트리를 죽인다.
// 실행 직후라 래퍼가 아직 PID를 못 적었을 수 있어 3초까지 기다린다.
const kKillScript = `$f = $env:SR_PID
for ($k = 0; $k -lt 30; $k++) {
	if ([IO.File]::Exists($f)) {
		$t = [IO.File]::ReadAllText($f).Trim().Split('|')
		if ($t.Length -eq 2 -and $t[1] -eq $env:SR_TOKEN) { & taskkill.exe /T /F /PID $t[0] | Out-Null; exit 0 }
	}
	Start-Sleep -Milliseconds 100
}
exit 3
`;

// 부팅 표식 본문. 지금 로그인 세션의 explorer 시작 시각(epoch ms)을 낸다.
// OS 부팅 시각(LastBootUpTime)은 빠른 시작이 켜져 있으면 "시스템 종료 → 켜기"에도 바뀌지 않아 쓰지 않는다.
// explorer를 못 찾을 때만 OS 부팅 시각으로 대신한다.
const kBootMarkScript = `$s = (Get-Process -Id $PID).SessionId
$e = Get-Process -Name explorer -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $s } | Sort-Object StartTime | Select-Object -First 1
if ($null -ne $e) { $t = $e.StartTime } else { $t = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime }
[Console]::Out.Write(([DateTimeOffset]$t).ToUnixTimeMilliseconds())
`;

//////////////////////////////////////////////////////////////////////////////////////
// PowerShell -EncodedCommand 값(UTF-16LE base64)을 만든다.
// @param _script: 스크립트 내용
export function EncodeCommand(_script: string): string
{
	let bin = "";
	for (let idx = 0; idx < _script.length; ++idx)
	{
		const code = _script.charCodeAt(idx);
		bin += String.fromCharCode(code & 0xff, code >> 8);
	}
	return btoa(bin);
}

//////////////////////////////////////////////////////////////////////////////////////
// PowerShell 실행 인자를 만든다. 스크립트 본문은 base64라 cmd.exe 특수문자 문제가 없다.
// @param _script: 스크립트 내용
export function PowerShellArgs(_script: string): string[]
{
	return ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", EncodeCommand(_script)];
}

export class ScriptLauncher implements IScriptLauncher
{
	// ==================== 멤버 ====================
	private readonly shell_: IShellExec;
	private readonly fs_: ITextFs;
	private readonly storageDir_: string;
	private readonly options_: ILauncherOptions;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 창구·파일 읽기·저장 폴더·설정 getter를 주입받는다.
	// @param _shell: 프로세스 실행 창구
	// @param _fs: UTF-8 텍스트 읽기·쓰기 창구
	// @param _storageDir: Plugin 저장 폴더(로그·PID 파일을 여기에 둔다)
	// @param _options: 설정 getter 묶음
	public constructor(_shell: IShellExec, _fs: ITextFs, _storageDir: string, _options: ILauncherOptions)
	{
		this.shell_ = _shell;
		this.fs_ = _fs;
		this.storageDir_ = _storageDir;
		this.options_ = _options;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 래퍼로 스크립트를 실행하고 끝날 때까지 기다린다. 제한 시간은 두지 않는다.
	// @param _req: 실행 요청
	public LaunchAsync(_req: ILaunchRequest): Promise<ILaunchResult>
	{
		return this.shell_.Exec(kPowerShell, PowerShellArgs(kWrapperScript), {
			Env: this.BuildEnv(_req),
			MaxOutputBytes: kExecOutputBytes,
			Signal: _req.Signal,
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 중인 래퍼의 프로세스 트리를 끝낸다. 토큰이 맞는 PID를 찾아 죽였으면 true.
	// @param _entryId: 항목 Id
	// @param _runToken: 실행 토큰
	public async KillAsync(_entryId: string, _runToken: string): Promise<boolean>
	{
		const res = await this.shell_.Exec(kPowerShell, PowerShellArgs(kKillScript), {
			Env: { SR_PID: this.PidPath(_entryId), SR_TOKEN: _runToken },
			TimeoutMs: kKillTimeoutMs,
			MaxOutputBytes: kExecOutputBytes,
		});
		return res.Code === 0;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 출력 파일을 비운다. 실행 시작 전에 불러, 이전 실행 출력이 이번 실행 로그로 섞이지 않게 한다.
	// @param _entryId: 항목 Id
	public ResetLogAsync(_entryId: string): Promise<void>
	{
		return this.fs_.WriteText(this.LogPath(_entryId), "");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목의 마지막(또는 실행 중) 출력 로그를 읽는다. 아직 없으면 빈 문자열.
	// @param _entryId: 항목 Id
	public async ReadLogAsync(_entryId: string): Promise<string>
	{
		try
		{
			return await this.fs_.ReadText(this.LogPath(_entryId));
		}
		catch
		{
			return "";
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 부팅 표식(로그인 세션 시작 시각, epoch ms)을 읽는다. 읽지 못하면 null.
	public async QueryBootMarkAsync(): Promise<number | null>
	{
		try
		{
			const res = await this.shell_.Exec(kPowerShell, PowerShellArgs(kBootMarkScript), { TimeoutMs: kKillTimeoutMs, MaxOutputBytes: kExecOutputBytes });
			const value = Number(res.Stdout.trim());
			return res.Code === 0 && Number.isFinite(value) && value > 0 ? value : null;
		}
		catch
		{
			return null;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 래퍼에 넘길 환경 변수를 만든다. 인자는 개수 + 번호별 변수로 나눠 JSON 파싱을 피한다.
	// @param _req: 실행 요청
	public BuildEnv(_req: ILaunchRequest): Record<string, string>
	{
		const env: Record<string, string> = {
			SR_PATH: _req.Path,
			SR_ARGC: String(_req.Args.length),
			SR_LOG: this.LogPath(_req.EntryId),
			SR_PID: this.PidPath(_req.EntryId),
			SR_TOKEN: _req.RunToken,
			SR_MAXLOG: String(Math.max(64, Math.round(this.options_.MaxLogKB())) * 1024),
			SR_PY: ScriptLauncher.OrDefault(this.options_.PythonExe(), "python"),
			SR_NODE: ScriptLauncher.OrDefault(this.options_.NodeExe(), "node"),
		};
		_req.Args.forEach((_value, _idx) => { env[`SR_ARG${_idx}`] = _value; });
		return env;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 로그 파일 경로. 실행마다 덮어쓰므로 항목당 1개다.
	// @param _entryId: 항목 Id
	public LogPath(_entryId: string): string
	{
		return `${this.storageDir_}/logs/${_entryId}.log`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 PID 파일 경로. 실행마다 덮어쓰므로 항목당 1개다.
	// @param _entryId: 항목 Id
	public PidPath(_entryId: string): string
	{
		return `${this.storageDir_}/run/${_entryId}.pid`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 래퍼 본문. 단위 테스트가 명령줄 길이를 재는 데 쓴다.
	public static WrapperScript(): string
	{
		return kWrapperScript;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 비어 있으면 기본값을 쓴다.
	// @param _value: 설정값
	// @param _def: 기본값
	private static OrDefault(_value: string, _def: string): string
	{
		const value = typeof _value === "string" ? _value.trim() : "";
		return value.length > 0 ? value : _def;
	}
}
