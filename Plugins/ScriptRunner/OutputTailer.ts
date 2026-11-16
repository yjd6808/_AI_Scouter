/*
	작성자: 윤정도
	생성일: 2026-11-14
	=====
	설명: OutputTailer. 실행 중인 스크립트의 출력 파일을 주기적으로 이어 읽어 완성된 줄만 RunLog에 넘긴다.
	      엔진 실행 이벤트를 받아 시작·종료 줄과 예약 알림 줄도 남긴다.
	      줄바꿈이 아직 안 온 끝부분은 다음 읽기로 미루고, 실행이 끝나면 마지막으로 한 번 더 읽어 남김없이 넘긴다.
	      같은 실행의 읽기는 순서대로 이어 붙여(체인) 겹쳐 읽지 않는다.
*/

import { RunLog } from "./RunLog";
import { RunnerEngine } from "./RunnerEngine";
import { ScriptFormat } from "./ScriptFormat";
import type { INowSource, IRunRecord, IScriptLauncher, TRunEvent, TRunTrigger } from "./Types";

interface ITail
{
	EntryId: string;
	Title: string;
	RunId: string;
	Offset: number;
	Partial: string;
	Chain: Promise<void>;
}

//////////////////////////////////////////////////////////////////////////////////////
// 실행 계기를 짧은 말로 바꾼다.
// @param _trigger: 실행 계기
function TriggerText(_trigger: TRunTrigger): string
{
	switch (_trigger)
	{
		case "Schedule": return "예약";
		case "Mcp": return "MCP";
		default: return "수동";
	}
}

//////////////////////////////////////////////////////////////////////////////////////
// 인자 목록을 한 줄로 보인다. 빈 값·공백 든 값은 따옴표로 감싼다.
// @param _args: 넘긴 인자
function ArgsText(_args: ReadonlyArray<string>): string
{
	return _args.map((_a) => (_a.length === 0 || /\s/.test(_a) ? `"${_a}"` : _a)).join(" ");
}

export class OutputTailer
{
	// ==================== 멤버 ====================
	private readonly engine_: RunnerEngine;
	private readonly launcher_: IScriptLauncher;
	private readonly log_: RunLog;
	private readonly now_: INowSource;
	private readonly tails_ = new Map<string, ITail>();

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진·실행기·로그·시계를 주입받는다. 구독은 Attach에서 한다.
	// @param _engine: 실행 엔진
	// @param _launcher: 실행기(출력 파일 읽기)
	// @param _log: 실행 로그
	// @param _now: 시계
	public constructor(_engine: RunnerEngine, _launcher: IScriptLauncher, _log: RunLog, _now: INowSource)
	{
		this.engine_ = _engine;
		this.launcher_ = _launcher;
		this.log_ = _log;
		this.now_ = _now;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진 실행 이벤트를 구독한다. 해지 함수를 돌려준다.
	public Attach(): () => void
	{
		return this.engine_.OnRunEvent((_event: TRunEvent) => { this.OnEvent(_event); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 중인 항목의 출력 파일을 한 번씩 이어 읽는다. 예약 tick마다 부른다.
	public PollAsync(): Promise<void>
	{
		return Promise.all([...this.tails_.values()].map((_t) => this.Queue(_t, false))).then(() => undefined);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 이벤트를 로그 줄로 바꾼다.
	// @param _event: 실행 이벤트
	private OnEvent(_event: TRunEvent): void
	{
		if (_event.Kind === "Started")
		{
			const tail: ITail = { EntryId: _event.EntryId, Title: _event.Title, RunId: _event.Record.RunId, Offset: 0, Partial: "", Chain: Promise.resolve() };
			this.tails_.set(_event.EntryId, tail);
			const args = _event.Record.Args.length > 0 ? ` · 인자: ${ArgsText(_event.Record.Args)}` : "";
			this.Write(tail.EntryId, tail.Title, [`▶ 실행 시작 ${_event.Record.RunId} (${TriggerText(_event.Record.Trigger)})${args}`]);
			return;
		}
		if (_event.Kind === "Finished")
		{
			void this.FinishAsync(_event.EntryId, _event.Title, _event.Record);
			return;
		}
		this.Write(_event.EntryId, _event.Title, [`⚠ ${_event.Text}`]);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행이 끝나면 남은 출력을 마저 읽고 종료 줄을 남긴다.
	// @param _entryId: 항목 Id
	// @param _title: 제목
	// @param _record: 실행 기록
	private async FinishAsync(_entryId: string, _title: string, _record: IRunRecord): Promise<void>
	{
		const tail = this.tails_.get(_entryId);
		if (tail !== undefined && tail.RunId === _record.RunId)
		{
			await this.Queue(tail, true);
			this.tails_.delete(_entryId);
		}
		const span = ScriptFormat.Span(_record.EndedAtMs - _record.StartedAtMs);
		const error = _record.Error.length > 0 ? ` · ${_record.Error.split(/\r?\n/)[0] ?? ""}` : "";
		this.Write(_entryId, _title, [`■ ${ScriptFormat.ResultText(_record)} · ${span}${error}`]);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 읽기 1번을 체인 끝에 건다. 같은 실행의 읽기가 겹치지 않는다.
	// @param _tail: 실행 추적 상태
	// @param _final: 마지막 읽기인지(끝부분까지 넘긴다)
	private Queue(_tail: ITail, _final: boolean): Promise<void>
	{
		_tail.Chain = _tail.Chain.then(() => this.ReadAsync(_tail, _final)).catch(() => undefined);
		return _tail.Chain;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 출력 파일에서 새로 늘어난 부분만 읽어 완성된 줄을 넘긴다.
	// 파일이 앞서 읽은 길이보다 짧아졌으면(다시 쓰였으면) 처음부터 다시 읽는다.
	// @param _tail: 실행 추적 상태
	// @param _final: 마지막 읽기인지
	private async ReadAsync(_tail: ITail, _final: boolean): Promise<void>
	{
		const text = await this.launcher_.ReadLogAsync(_tail.EntryId);
		if (text.length < _tail.Offset)
		{
			_tail.Offset = 0;
			_tail.Partial = "";
		}
		const parts = (_tail.Partial + text.slice(_tail.Offset)).split(/\r?\n/);
		_tail.Offset = text.length;
		const rest = parts.pop() ?? "";
		_tail.Partial = _final ? "" : rest;
		if (_final && rest.length > 0)
			parts.push(rest);
		this.Write(_tail.EntryId, _tail.Title, parts);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 줄 묶음을 같은 시각으로 로그에 넘긴다.
	// @param _entryId: 항목 Id
	// @param _title: 제목
	// @param _texts: 줄 내용
	private Write(_entryId: string, _title: string, _texts: ReadonlyArray<string>): void
	{
		if (_texts.length === 0)
			return;
		const ts = this.now_.Now();
		this.log_.Add(_texts.map((_t) => ({ Ts: ts, EntryId: _entryId, Title: _title, Text: _t })));
	}
}
