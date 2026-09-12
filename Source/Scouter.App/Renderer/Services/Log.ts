/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 정적 로그 파사드. LogBuffer + 싱크(FileLogSink)로 보낸다.
*/

import { LogBuffer } from "./LogBuffer";
import type { ILogEntry, LogLevel } from "@scouter/gui";
import type { FileLogSink } from "./FileLogSink";

export class Log
{
	// ==================== 정적 ====================
	private static s_level_: LogLevel = "info";
	private static readonly s_buffer_ = new LogBuffer(10000);
	private static s_sink_: FileLogSink | null = null;

	// ==================== 속성 ====================
	public static get Buffer(): LogBuffer { return Log.s_buffer_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그 레벨을 초기화한다.
	// @param _opts: 레벨 옵션
	public static Init(_opts: { Level: string }): void
	{
		if (_opts.Level === "debug" || _opts.Level === "info" || _opts.Level === "warn" || _opts.Level === "error")
			Log.s_level_ = _opts.Level;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 싱크를 붙인다. Bootstrap에서 1회.
	// @param _sink: 싱크
	public static SetSink(_sink: FileLogSink): void
	{
		Log.s_sink_ = _sink;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 범위 로그를 만든다. Plugin Scope용.
	// @param _scope: 범위
	public static Scope(_scope: string): { Debug(_msg: string, _data?: unknown): void; Info(_msg: string, _data?: unknown): void; Warn(_msg: string, _data?: unknown): void; Error(_msg: string, _data?: unknown): void }
	{
		return {
			Debug: (_msg: string, _data?: unknown): void => { Log.Write("debug", _scope, _msg, _data); },
			Info: (_msg: string, _data?: unknown): void => { Log.Write("info", _scope, _msg, _data); },
			Warn: (_msg: string, _data?: unknown): void => { Log.Write("warn", _scope, _msg, _data); },
			Error: (_msg: string, _data?: unknown): void => { Log.Write("error", _scope, _msg, _data); },
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 디버그 로그.
	// @param _scope: 범위
	// @param _msg: 메시지
	// @param _data: 부가값
	public static Debug(_scope: string, _msg: string, _data?: unknown): void
	{
		Log.Write("debug", _scope, _msg, _data);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 정보 로그.
	// @param _scope: 범위
	// @param _msg: 메시지
	// @param _data: 부가값
	public static Info(_scope: string, _msg: string, _data?: unknown): void
	{
		Log.Write("info", _scope, _msg, _data);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 경고 로그.
	// @param _scope: 범위
	// @param _msg: 메시지
	// @param _data: 부가값
	public static Warn(_scope: string, _msg: string, _data?: unknown): void
	{
		Log.Write("warn", _scope, _msg, _data);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에러 로그.
	// @param _scope: 범위
	// @param _msg: 메시지
	// @param _data: 부가값
	public static Error(_scope: string, _msg: string, _data?: unknown): void
	{
		Log.Write("error", _scope, _msg, _data);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 레벨 필터 후 버퍼·싱크·콘솔에 보낸다.
	// @param _level: 레벨
	// @param _scope: 범위
	// @param _msg: 메시지
	// @param _data: 부가값
	private static Write(_level: LogLevel, _scope: string, _msg: string, _data?: unknown): void
	{
		const order: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
		if (order[_level] < order[Log.s_level_])
			return;
		const entry: ILogEntry = { Ts: Date.now(), Level: _level, Scope: _scope, Msg: _msg };
		if (_data !== undefined)
			entry.Data = _data;
		Log.s_buffer_.Push(entry);
		Log.s_sink_?.Write(entry);
		if (_level === "warn")
			console.warn(`[${_scope}] ${_msg}`);
		else if (_level === "error")
			console.error(`[${_scope}] ${_msg}`);
		else
			console.log(`[${_scope}] ${_msg}`);
	}
}
