/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Process. spawn 실행 + 타임아웃 + 출력 상한. UTF-8 고정.
*/

import { spawn } from "node:child_process";

// Windows에서는 shell 경유로 실행한다. PATHEXT(.cmd/.bat) 탐색용.
const kShell = process.platform === "win32";

export interface IProcessOptions
{
	Env?: Record<string, string>;
	Cwd?: string;
	TimeoutMs?: number;
	MaxOutputBytes?: number;
	Signal?: AbortSignal;
}

export interface IProcessResult
{
	Code: number;
	Stdout: string;
	Stderr: string;
	TimedOut: boolean;
	Truncated: boolean;
	DurationMs: number;
}

export class Process
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행하고 종료까지 기다린다.
	// @param _cmd: 명령
	// @param _args: 인자
	// @param _opts: 옵션
	public static Run(_cmd: string, _args: string[], _opts: IProcessOptions = {}): Promise<IProcessResult>
	{
		const started = Date.now();
		const maxBytes = _opts.MaxOutputBytes ?? 8 * 1024 * 1024;
		return new Promise((_resolve) =>
		{
			const child = spawn(_cmd, _args, {
				windowsHide: true,
				shell: kShell,
				cwd: _opts.Cwd,
				env: { ...process.env, ..._opts.Env },
				signal: _opts.Signal,
			});
			let stdout = "";
			let stderr = "";
			let truncated = false;
			let timedOut = false;
			const timer = _opts.TimeoutMs !== undefined ? setTimeout(() =>
			{
				timedOut = true;
				child.kill();
			}, _opts.TimeoutMs) : null;
			child.stdout.on("data", (_chunk: Buffer) =>
			{
				stdout += _chunk.toString("utf-8");
				if (stdout.length > maxBytes)
				{
					truncated = true;
					child.kill();
				}
			});
			child.stderr.on("data", (_chunk: Buffer) =>
			{
				stderr += _chunk.toString("utf-8");
				if (stderr.length > maxBytes)
				{
					truncated = true;
					child.kill();
				}
			});
			child.on("error", () =>
			{
				if (timer !== null)
					clearTimeout(timer);
				_resolve({ Code: -1, Stdout: stdout, Stderr: stderr, TimedOut: timedOut, Truncated: truncated, DurationMs: Date.now() - started });
			});
			child.on("close", (_code) =>
			{
				if (timer !== null)
					clearTimeout(timer);
				_resolve({ Code: _code ?? -1, Stdout: stdout, Stderr: stderr, TimedOut: timedOut, Truncated: truncated, DurationMs: Date.now() - started });
			});
		});
	}
}
