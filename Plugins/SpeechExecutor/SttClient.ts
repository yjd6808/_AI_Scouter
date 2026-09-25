/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: SttClient. Python 사이드카를 자식으로 띄우고 WebSocket으로 partial/final 수신.
*/

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

export interface ISttEvents
{
	OnPartial(_text: string): void;
	OnFinal(_text: string): void;
	OnStatus(_state: string, _detail: string): void;
}

export class SttClient
{
	// ==================== 멤버 ====================
	private events_: ISttEvents | null = null;
	private proc_: ChildProcess | null = null;
	private socket_: WebSocket | null = null;
	private running_ = false;
	private errTail_ = "";
	private wantListen_ = false;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이벤트를 묶는다.
	// @param _events: 이벤트
	public Bind(_events: ISttEvents): void
	{
		this.events_ = _events;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사이드카를 띄우고 STT 세션을 시작한다.
	// @param _python: python 실행파일
	// @param _serverPy: asr_server.py 경로
	// @param _modelId: 모델 id
	// @param _language: 언어
	// @param _apiKey: API 키
	public async Start(_python: string, _serverPy: string, _modelId: string, _language: string, _apiKey: string): Promise<void>
	{
		if (this.running_)
			return;
		this.running_ = true;
		this.errTail_ = "";
		const proc = spawn(_python,
			[
				_serverPy,
				"--adapter", "gemini_live",
				"--model-id", _modelId,
				"--language", _language,
				"--device", "default",
				"--port", "0",
				"--api-key", _apiKey,
				// 부모(렌더러)가 죽으면 사이드카가 고아로 남지 않게 워치독에 PID 전달.
				"--parent-pid", String(process.pid),
			],
			{ stdio: ["ignore", "pipe", "pipe"] });
		this.proc_ = proc;
		const stderr = proc.stderr;
		stderr.setEncoding("utf8");
		stderr.on("data", (_chunk: string) =>
		{
			this.errTail_ = (this.errTail_ + _chunk).slice(-2000);
		});
		try
		{
			const port = await this.ReadPort(proc);
			this.Connect(port);
		}
		catch (_e)
		{
			// 시작 실패 시 플래그를 내려 다음 시도가 가능하게 한다.
			this.running_ = false;
			try
			{
				proc.kill();
			}
			catch
			{
				// 무시.
			}
			this.proc_ = null;
			const tail = this.errTail_.split("\n").map((_l) => _l.trim()).filter((_l) => _l.length > 0).pop() ?? "";
			const why = _e instanceof Error ? _e.message : String(_e);
			throw new Error(tail.length > 0 ? `${why} / ${tail}` : why);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 세션 종료.
	public Stop(): void
	{
		this.running_ = false;
		this.wantListen_ = false;
		if (this.socket_ !== null)
		{
			try
			{
				this.socket_.close();
			}
			catch
			{
				// 무시.
			}
			this.socket_ = null;
		}
		if (this.proc_ !== null)
		{
			try
			{
				this.proc_.kill();
			}
			catch
			{
				// 무시.
			}
			this.proc_ = null;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 듣기 on/off를 사이드카에 전달. 소켓이 아직 열리는 중이면 onopen에서 따라간다.
	// @param _active: 듣기 여부
	public Listen(_active: boolean): void
	{
		this.wantListen_ = _active;
		if (this.socket_ === null || this.socket_.readyState !== WebSocket.OPEN)
			return;
		this.socket_.send(JSON.stringify({ type: "listen", active: _active }));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사이드카 상태 리셋.
	public Reset(): void
	{
		if (this.socket_ === null || this.socket_.readyState !== WebSocket.OPEN)
			return;
		this.socket_.send(JSON.stringify({ type: "reset" }));
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// stdout에서 PORT= 행을 읽는다.
	// @param _proc: 프로세스
	private ReadPort(_proc: ChildProcess): Promise<number>
	{
		return new Promise((_resolve, _reject) =>
		{
			let buf = "";
			const timer = setTimeout(() =>
			{
				_reject(new Error("사이드카 포트 대기 초과"));
			}, 120000);
			const out = _proc.stdout;
			if (out === null)
			{
				clearTimeout(timer);
				_reject(new Error("사이드카 stdout 없음"));
				return;
			}
			out.setEncoding("utf8");
			out.on("data", (_chunk: string) =>
			{
				buf += _chunk;
				const lines = buf.split("\n");
				for (let idx = 0; idx < lines.length; idx++)
				{
					const line = lines[idx];
					if (line === undefined)
						continue;
					if (line.startsWith("PORT="))
					{
						clearTimeout(timer);
						_resolve(Number(line.slice(5)));
						return;
					}
				}
			});
			_proc.on("error", (_e: unknown) =>
			{
				clearTimeout(timer);
				_reject(_e instanceof Error ? _e : new Error(String(_e)));
			});
			_proc.on("exit", (_code: number | null) =>
			{
				clearTimeout(timer);
				_reject(new Error(`사이드카 종료 code=${String(_code)}`));
			});
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// WebSocket 접속.
	// @param _port: 포트
	private Connect(_port: number): void
	{
		const socket = new WebSocket(`ws://127.0.0.1:${_port}/`);
		this.socket_ = socket;
		socket.onopen = (): void =>
		{
			this.events_?.OnStatus("connected", `STT 사이드카 연결됨 (localhost:${String(_port)})`);
			if (this.wantListen_ && this.socket_ !== null && this.socket_.readyState === WebSocket.OPEN)
				this.socket_.send(JSON.stringify({ type: "listen", active: true }));
		};
		socket.onmessage = (_ev: MessageEvent): void =>
		{
			this.Dispatch(String(_ev.data));
		};
		socket.onerror = (): void =>
		{
			this.events_?.OnStatus("error", "STT 소켓 오류");
		};
		socket.onclose = (): void =>
		{
			this.socket_ = null;
			this.events_?.OnStatus("disconnected", "STT 사이드카 연결 끊어짐");
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 수신 프레임 분기.
	// @param _raw: 원문
	private Dispatch(_raw: string): void
	{
		let msg: { type?: string; text?: string; state?: string; detail?: string };
		try
		{
			msg = JSON.parse(_raw) as { type?: string; text?: string; state?: string; detail?: string };
		}
		catch
		{
			return;
		}
		if (msg.type === "partial")
			this.events_?.OnPartial(msg.text ?? "");
		else if (msg.type === "final")
			this.events_?.OnFinal(msg.text ?? "");
		else if (msg.type === "status")
			this.events_?.OnStatus(msg.state ?? "", msg.detail ?? "");
	}
}
