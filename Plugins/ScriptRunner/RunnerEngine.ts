/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: RunnerEngine. 등록·수정·삭제·실행·중지·예약 tick·복원 판정 담당.
	      UI/IO 의존이 없고 시계·실행기·저장소를 주입받아 실제 프로세스 없이 단위 테스트할 수 있다.
	      항목 1개는 동시에 1번만 실행된다. 예약 시각이 왔는데 아직 실행 중이면 그 회차는 건너뛴다.
	      Revision은 목록 구조(추가·삭제·정의 변경)가 바뀔 때만 오른다. 화면은 이 값이 바뀔 때만
	      행을 다시 만들어, 인자 입력란에 글자를 치는 동안 입력란이 다시 만들어지지 않게 한다.
*/

import { ScheduleCalc } from "./ScheduleCalc";
import { CloneArgs, CloneSchedule, ScriptStore } from "./ScriptStore";
import type { IEntryPatch, IEntrySpec, INowSource, IOutputSnapshot, IRestoreReport, IRunRecord, IRunnerLogger, IScriptArg, IScriptEntry, IScriptLauncher, TArgValues, TEntryOutcome, TEntryState, TMissedSink, TRunEvent, TRunOutcome, TRunTrigger } from "./Types";

const kStopWaitMs = 5000;
// 같은 로그인 세션인데도 시각을 다시 읽으면 반올림 등으로 조금 다를 수 있어 이만큼은 같다고 본다.
const kBootMarkToleranceMs = 5000;
const kPresetNameMax = 40;
const kDefaultOutputChars = 16000;

export interface IRunnerEngineDeps
{
	Store: ScriptStore;
	Launcher: IScriptLauncher;
	Now: INowSource;
	Logger: IRunnerLogger;
	Missed?: TMissedSink | undefined;
}

interface IRunningHandle
{
	EntryId: string;
	Title: string;
	RunToken: string;
	Controller: AbortController;
	Record: IRunRecord;
	StopRequested: boolean;
	Done: Promise<IRunRecord>;
}

type TValuesOutcome =
	| { Ok: true }
	| { Ok: false; Error: string };

//////////////////////////////////////////////////////////////////////////////////////
// 경로 앞뒤 공백과 감싼 따옴표를 걷는다. 탐색기 "경로로 복사"는 따옴표를 붙여 준다.
// @param _path: 입력 경로
export function CleanPath(_path: string): string
{
	let path = _path.trim();
	if (path.length >= 2 && path.startsWith("\"") && path.endsWith("\""))
		path = path.slice(1, -1).trim();
	return path;
}

export class RunnerEngine
{
	// ==================== 멤버 ====================
	private readonly store_: ScriptStore;
	private readonly launcher_: IScriptLauncher;
	private readonly now_: INowSource;
	private readonly logger_: IRunnerLogger;
	private readonly missed_: TMissedSink | null;
	private readonly running_ = new Map<string, IRunningHandle>();
	private readonly listeners_ = new Set<() => void>();
	private readonly runListeners_ = new Set<(_event: TRunEvent) => void>();
	private revision_ = 0;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 의존성을 주입받는다. 복원 판정은 생성자에서 하지 않는다 — Restore()를 따로 부른다.
	// @param _deps: 저장소·실행기·시계·로거·놓침 싱크
	public constructor(_deps: IRunnerEngineDeps)
	{
		this.store_ = _deps.Store;
		this.launcher_ = _deps.Launcher;
		this.now_ = _deps.Now;
		this.logger_ = _deps.Logger;
		this.missed_ = _deps.Missed ?? null;
	}

	// ==================== 속성 ====================
	public get Store(): ScriptStore { return this.store_; }
	public get Revision(): number { return this.revision_; }
	public get RunningCount(): number { return this.running_.size; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 앱이 꺼져 있던 동안의 상태를 정리한다. 활성화 때 1번만 부른다.
	// 부팅 표식(로그인 세션 시작 시각)이 지난번과 다르면 PC를 다시 켠(또는 다시 로그인한) 것이다.
	// 그때는 "부팅 후에도 스케줄 적용"이 꺼진 항목의 예약을 푼다. Scouter만 다시 켠 경우는 표식이 같아 그대로 둔다.
	// 실행 중으로 남은 기록은 결과를 알 수 없으니 오류로 닫는다. 지난 예약은 반복이면 다음 회차로
	// 넘기고(지난 회차는 실행하지 않는다), 1회 예약이면 "지나감"으로 표시하고 예약을 푼다.
	// @param _bootMarkMs: 지금 부팅 표식(epoch ms). 알아내지 못했으면 null(부팅 판정을 건너뛴다)
	public Restore(_bootMarkMs: number | null = null): IRestoreReport
	{
		const now = this.now_.Now();
		const report: IRestoreReport = { Missed: [], Advanced: 0, Interrupted: 0, Rebooted: false, ClearedByBoot: [] };
		const previousMark = this.store_.BootMarkMs;
		if (_bootMarkMs !== null && _bootMarkMs > 0)
		{
			report.Rebooted = previousMark > 0 && Math.abs(_bootMarkMs - previousMark) > kBootMarkToleranceMs;
			if (_bootMarkMs !== previousMark)
				this.store_.SetBootMarkMs(_bootMarkMs);
		}
		for (const entry of this.store_.List())
		{
			if (report.Rebooted && !entry.KeepAfterBoot && entry.NextDueAtMs > 0)
			{
				entry.NextDueAtMs = 0;
				report.ClearedByBoot.push(entry);
			}
			if (entry.LastRun !== null && entry.LastRun.Result === "Running")
			{
				entry.LastRun.Result = "Error";
				entry.LastRun.EndedAtMs = now;
				entry.LastRun.Error = "앱이 종료되어 실행 결과를 알 수 없습니다.";
				++report.Interrupted;
			}
			if (entry.NextDueAtMs <= 0 || entry.NextDueAtMs > now)
				continue;
			const next = ScheduleCalc.NextAfterFire(entry.Schedule, entry.NextDueAtMs, now);
			if (next > 0)
			{
				entry.NextDueAtMs = next;
				++report.Advanced;
			}
			else
			{
				entry.MissedAtMs = entry.NextDueAtMs;
				entry.NextDueAtMs = 0;
				report.Missed.push(entry);
			}
		}
		this.store_.Save();
		if (report.Missed.length > 0)
			this.missed_?.(report.Missed);
		return report;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스크립트를 등록한다. 제목이 비면 "스크립트-N"을 붙인다. 예약이 켜져 있으면 첫 실행 시각을 건다.
	// @param _spec: 등록 정보
	public Register(_spec: IEntrySpec): TEntryOutcome
	{
		const now = this.now_.Now();
		const checked = this.CheckSpec(_spec);
		if (!checked.Ok)
			return checked;
		const due = ScheduleCalc.FirstDue(_spec.Schedule, now);
		if (!due.Ok)
			return due;
		const title = _spec.Title.trim();
		const entry: IScriptEntry = {
			Id: this.store_.NewId(),
			Title: title.length > 0 ? title : this.store_.DefaultTitle(),
			Path: CleanPath(_spec.Path),
			Args: RunnerEngine.TrimArgs(_spec.Args),
			Schedule: CloneSchedule(_spec.Schedule),
			KeepAfterBoot: _spec.KeepAfterBoot,
			Presets: [],
			SelectedPreset: "",
			NextDueAtMs: due.DueAtMs,
			MissedAtMs: 0,
			CreatedAtMs: now,
			UpdatedAtMs: now,
			RunCount: 0,
			LastRun: null,
		};
		this.store_.Add(entry);
		this.logger_.Info("[ScriptRunner] 등록", { Id: entry.Id, Title: entry.Title });
		this.Touch(true);
		return { Ok: true, Entry: entry };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 고친다. 준 필드만 바꾼다. 예약 설정을 주면 첫 실행 시각을 지금 기준으로 다시 건다.
	// 실행 중이어도 고칠 수 있고, 바뀐 경로·인자는 다음 실행부터 쓴다.
	// @param _id: 항목 Id
	// @param _patch: 바꿀 필드
	public Update(_id: string, _patch: IEntryPatch): TEntryOutcome
	{
		const entry = this.store_.Find(_id);
		if (entry === null)
			return { Ok: false, Error: `없는 스크립트 Id입니다: ${_id}` };
		const now = this.now_.Now();
		const spec: IEntrySpec = {
			Title: _patch.Title ?? entry.Title,
			Path: _patch.Path ?? entry.Path,
			Args: _patch.Args ?? entry.Args,
			Schedule: _patch.Schedule ?? entry.Schedule,
			KeepAfterBoot: _patch.KeepAfterBoot ?? entry.KeepAfterBoot,
		};
		const checked = this.CheckSpec(spec);
		if (!checked.Ok)
			return checked;
		let due = entry.NextDueAtMs;
		if (_patch.Schedule !== undefined)
		{
			const outcome = ScheduleCalc.FirstDue(_patch.Schedule, now);
			if (!outcome.Ok)
				return outcome;
			due = outcome.DueAtMs;
		}
		const args = RunnerEngine.TrimArgs(spec.Args);
		if (_patch.ArgValues !== undefined)
		{
			const applied = RunnerEngine.ApplyValues(args, _patch.ArgValues);
			if (!applied.Ok)
				return applied;
		}
		const title = spec.Title.trim();
		entry.Title = title.length > 0 ? title : entry.Title;
		entry.Path = CleanPath(spec.Path);
		entry.Args = args;
		entry.KeepAfterBoot = spec.KeepAfterBoot;
		if (_patch.Schedule !== undefined)
		{
			entry.Schedule = CloneSchedule(_patch.Schedule);
			entry.NextDueAtMs = due;
			entry.MissedAtMs = 0;
		}
		entry.UpdatedAtMs = now;
		this.store_.Save();
		this.Touch(true);
		return { Ok: true, Entry: entry };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약을 지금 기준으로 다시 건다. 예약이 꺼진 항목은 거부한다.
	// @param _id: 항목 Id
	public Rearm(_id: string): TEntryOutcome
	{
		const entry = this.store_.Find(_id);
		if (entry === null)
			return { Ok: false, Error: `없는 스크립트 Id입니다: ${_id}` };
		if (!entry.Schedule.Enabled)
			return { Ok: false, Error: "예약이 꺼진 스크립트입니다. 수정에서 스케줄링을 켜세요." };
		return this.Update(_id, { Schedule: entry.Schedule });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 지운다. 실행 중이면 먼저 중지한다. 지웠으면 true.
	// @param _id: 항목 Id
	public async RemoveAsync(_id: string): Promise<boolean>
	{
		if (this.store_.Find(_id) === null)
			return false;
		if (this.running_.has(_id))
			await this.StopAsync(_id);
		const removed = this.store_.Remove(_id);
		if (removed)
			this.Touch(true);
		return removed;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 화면 입력란에서 인자 값 1개를 고친다. 구조가 아니라 값만 바뀌므로 Revision은 그대로 둔다.
	// @param _id: 항목 Id
	// @param _index: 인자 순번
	// @param _value: 새 값
	public SetArgValue(_id: string, _index: number, _value: string): void
	{
		const arg = this.store_.Find(_id)?.Args[_index];
		if (arg === undefined || arg.Value === _value)
			return;
		arg.Value = _value;
		this.store_.Save();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋을 저장한다. 같은 이름이 있으면 덮어쓴다. 값을 주지 않으면 지금 인자 값을 저장하고 그 프리셋을
	// 선택 상태로 둔다. 값은 인자 이름으로 저장해 인자 순서가 바뀌어도 맞게 들어간다.
	// @param _id: 항목 Id
	// @param _name: 프리셋 이름
	// @param _values: 저장할 값(이름별 객체 또는 순서대로 배열). 생략하면 지금 값
	public SavePreset(_id: string, _name: string, _values?: TArgValues): TEntryOutcome
	{
		const entry = this.store_.Find(_id);
		if (entry === null)
			return { Ok: false, Error: `없는 스크립트 Id입니다: ${_id}` };
		const name = _name.trim();
		const bad = RunnerEngine.CheckPresetName(name);
		if (bad.length > 0)
			return { Ok: false, Error: bad };
		if (entry.Args.length === 0)
			return { Ok: false, Error: "인자가 없는 스크립트는 프리셋을 저장할 수 없습니다." };
		const args = CloneArgs(entry.Args);
		if (_values !== undefined)
		{
			const applied = RunnerEngine.ApplyValues(args, _values);
			if (!applied.Ok)
				return applied;
		}
		const values: Record<string, string> = {};
		for (const arg of args)
			values[arg.Name] = arg.Value;
		const found = entry.Presets.find((_p) => _p.Name === name);
		if (found !== undefined)
			found.Values = values;
		else
			entry.Presets.push({ Name: name, Values: values });
		// 지금 값을 저장했을 때만 선택 상태로 둔다. 값을 따로 받아 저장하면 입력란 값과 프리셋이 달라
		// 콤보박스가 그 프리셋을 가리키면 거짓말이 된다.
		if (_values === undefined)
			entry.SelectedPreset = name;
		entry.UpdatedAtMs = this.now_.Now();
		this.store_.Save();
		this.Touch(true);
		return { Ok: true, Entry: entry };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋을 지운다. 선택돼 있었으면 선택을 "없음"으로 돌린다. 인자 값은 그대로 둔다.
	// @param _id: 항목 Id
	// @param _name: 프리셋 이름
	public DeletePreset(_id: string, _name: string): TEntryOutcome
	{
		const entry = this.store_.Find(_id);
		if (entry === null)
			return { Ok: false, Error: `없는 스크립트 Id입니다: ${_id}` };
		const idx = entry.Presets.findIndex((_p) => _p.Name === _name.trim());
		if (idx < 0)
			return { Ok: false, Error: `없는 프리셋입니다: ${_name}` };
		entry.Presets.splice(idx, 1);
		if (entry.SelectedPreset === _name.trim())
			entry.SelectedPreset = "";
		this.store_.Save();
		this.Touch(true);
		return { Ok: true, Entry: entry };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋을 불러와 인자 값에 채우고 선택 상태로 둔다. 빈 이름은 "없음" 선택(값은 그대로)이다.
	// 프리셋에 없는 인자(프리셋 저장 뒤 추가한 인자)는 지금 값을 그대로 둔다.
	// @param _id: 항목 Id
	// @param _name: 프리셋 이름("" = 없음)
	public ApplyPreset(_id: string, _name: string): TEntryOutcome
	{
		const entry = this.store_.Find(_id);
		if (entry === null)
			return { Ok: false, Error: `없는 스크립트 Id입니다: ${_id}` };
		const applied = RunnerEngine.FillFromPreset(entry, _name.trim());
		if (!applied.Ok)
			return applied;
		this.store_.Save();
		this.Touch(true);
		return { Ok: true, Entry: entry };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스크립트를 1번 실행한다. 바로 돌아오고, 끝나는 시점은 결과의 Done으로 기다린다.
	// 프리셋을 주면 먼저 불러오고, 값을 주면 그다음 덮어쓴다(화면 입력란에도 그 값이 보인다).
	// @param _id: 항목 Id
	// @param _trigger: 실행 계기
	// @param _values: 인자 값(이름별 객체 또는 순서대로 배열). 생략하면 저장된 값
	// @param _preset: 먼저 불러올 프리셋 이름. 생략하면 불러오지 않는다
	public Run(_id: string, _trigger: TRunTrigger, _values?: TArgValues, _preset?: string): TRunOutcome
	{
		const entry = this.store_.Find(_id);
		if (entry === null)
			return { Ok: false, Error: `없는 스크립트 Id입니다: ${_id}` };
		if (this.running_.has(_id))
			return { Ok: false, Error: `이미 실행 중입니다: ${entry.Title}` };
		if (_preset !== undefined && _preset.trim().length > 0)
		{
			const loaded = RunnerEngine.FillFromPreset(entry, _preset.trim());
			if (!loaded.Ok)
				return loaded;
		}
		if (_values !== undefined)
		{
			const applied = RunnerEngine.ApplyValues(entry.Args, _values);
			if (!applied.Ok)
				return applied;
		}
		const missing = entry.Args.filter((_a) => _a.Required && _a.Value.trim().length === 0).map((_a) => _a.Name);
		if (missing.length > 0)
			return { Ok: false, Error: `필수 인자가 비어 있습니다: ${missing.join(", ")}` };
		if (entry.Path.length === 0)
			return { Ok: false, Error: "스크립트 경로가 비어 있습니다." };
		const now = this.now_.Now();
		const argv = RunnerEngine.PositionalArgs(entry.Args);
		entry.RunCount += 1;
		const record: IRunRecord = {
			RunId: `${entry.Id}.${entry.RunCount}`,
			Trigger: _trigger,
			StartedAtMs: now,
			EndedAtMs: 0,
			ExitCode: -1,
			Result: "Running",
			Args: argv,
			Error: "",
		};
		entry.LastRun = record;
		entry.MissedAtMs = 0;
		this.store_.Save();
		const controller = new AbortController();
		const token = `${now.toString(36)}${Math.random().toString(36).slice(2, 10)}`;
		const handle: IRunningHandle = {
			EntryId: entry.Id,
			Title: entry.Title,
			RunToken: token,
			Controller: controller,
			Record: record,
			StopRequested: false,
			Done: Promise.resolve(record),
		};
		this.running_.set(entry.Id, handle);
		handle.Done = this.WatchAsync(handle, entry.Path, argv);
		this.logger_.Info("[ScriptRunner] 실행", { Id: entry.Id, RunId: record.RunId, Trigger: _trigger });
		// 값·프리셋을 받아 바꿨으면 화면 입력란도 새 값으로 다시 그려야 하므로 구조 변경으로 알린다.
		this.Touch(_values !== undefined || (_preset !== undefined && _preset.trim().length > 0));
		return { Ok: true, RunId: record.RunId, Done: handle.Done };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 중인 스크립트를 중지한다. 프로세스 트리를 끝낸 뒤 실행 종료를 잠깐 기다린다.
	// 실행 중이 아니면 false.
	// @param _id: 항목 Id
	public async StopAsync(_id: string): Promise<boolean>
	{
		const handle = this.running_.get(_id);
		if (handle === undefined)
			return false;
		if (!handle.StopRequested)
		{
			handle.StopRequested = true;
			try
			{
				const killed = await this.launcher_.KillAsync(handle.EntryId, handle.RunToken);
				if (!killed)
					this.logger_.Warn("[ScriptRunner] 프로세스 트리를 찾지 못해 실행 창구만 끊습니다", { Id: _id });
			}
			catch (_err: unknown)
			{
				this.logger_.Warn("[ScriptRunner] 중지 명령 실패", { Id: _id, Error: String(_err) });
			}
			handle.Controller.abort();
		}
		await Promise.race([handle.Done, new Promise<void>((_resolve) => { setTimeout(_resolve, kStopWaitMs); })]);
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 중인 스크립트를 전부 중지한다. 중지한 개수를 돌려준다.
	public async StopAllAsync(): Promise<number>
	{
		const ids = [...this.running_.keys()];
		await Promise.all(ids.map((_id) => this.StopAsync(_id)));
		return ids.length;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 시각이 지난 항목을 실행한다. 반복이면 다음 회차를 걸고, 1회 예약이면 푼다.
	// 실행 중이라 건너뛰거나 인자가 모자라 실행하지 못한 회차는 기록으로 남긴다. 실행한 개수를 돌려준다.
	public Tick(): number
	{
		const now = this.now_.Now();
		let fired = 0;
		let changed = false;
		for (const entry of this.store_.List())
		{
			if (entry.NextDueAtMs <= 0 || entry.NextDueAtMs > now)
				continue;
			const due = entry.NextDueAtMs;
			entry.NextDueAtMs = ScheduleCalc.NextAfterFire(entry.Schedule, due, now);
			changed = true;
			if (this.running_.has(entry.Id))
			{
				this.logger_.Info("[ScriptRunner] 실행 중이라 이번 예약 회차를 건너뜀", { Id: entry.Id, DueAtMs: due });
				this.EmitRun({ Kind: "Notice", EntryId: entry.Id, Title: entry.Title, Text: "실행 중이라 이번 예약 회차를 건너뜁니다." });
				continue;
			}
			const outcome = this.Run(entry.Id, "Schedule");
			if (outcome.Ok)
			{
				++fired;
				continue;
			}
			entry.RunCount += 1;
			entry.LastRun = {
				RunId: `${entry.Id}.${entry.RunCount}`,
				Trigger: "Schedule",
				StartedAtMs: now,
				EndedAtMs: now,
				ExitCode: -1,
				Result: "Error",
				Args: [],
				Error: outcome.Error,
			};
			this.logger_.Warn("[ScriptRunner] 예약 실행 실패", { Id: entry.Id, Error: outcome.Error });
			this.EmitRun({ Kind: "Notice", EntryId: entry.Id, Title: entry.Title, Text: `예약 실행 실패: ${outcome.Error}` });
		}
		if (changed)
		{
			this.store_.Save();
			this.Touch(false);
		}
		return fired;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 중인지 본다.
	// @param _id: 항목 Id
	public IsRunning(_id: string): boolean
	{
		return this.running_.has(_id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 상태를 구한다. 실행 중이 예약보다 앞선다.
	// @param _entry: 항목
	public StateOf(_entry: IScriptEntry): TEntryState
	{
		if (this.running_.has(_entry.Id))
			return "Running";
		return _entry.NextDueAtMs > 0 ? "Scheduled" : "Idle";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 다음 예약까지 남은 시간(ms). 예약이 없으면 0.
	// @param _entry: 항목
	// @param _nowMs: 기준 시각
	public RemainingMs(_entry: IScriptEntry, _nowMs: number): number
	{
		return _entry.NextDueAtMs > 0 ? Math.max(0, _entry.NextDueAtMs - _nowMs) : 0;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 출력 로그 끝부분을 읽는다. 실행 중이면 지금까지 쓴 만큼이다.
	// @param _id: 항목 Id
	// @param _maxChars: 돌려줄 최대 글자 수(끝에서부터)
	public async ReadOutputAsync(_id: string, _maxChars: number = kDefaultOutputChars): Promise<IOutputSnapshot>
	{
		const text = await this.launcher_.ReadLogAsync(_id);
		const max = Math.max(1, Math.floor(_maxChars));
		if (text.length <= max)
			return { Text: text, TotalChars: text.length, Truncated: false };
		return { Text: text.slice(text.length - max), TotalChars: text.length, Truncated: true };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태 변경 구독. 해지 함수를 돌려준다.
	// @param _handler: 변경 알림
	public OnChanged(_handler: () => void): () => void
	{
		this.listeners_.add(_handler);
		return () => { this.listeners_.delete(_handler); };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 이벤트(시작·종료·예약 알림) 구독. 실행 로그 수집기가 쓴다. 해지 함수를 돌려준다.
	// @param _handler: 이벤트 처리기
	public OnRunEvent(_handler: (_event: TRunEvent) => void): () => void
	{
		this.runListeners_.add(_handler);
		return () => { this.runListeners_.delete(_handler); };
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 1건의 종료를 기다려 기록을 닫는다. 실행기가 실패해도 기록은 반드시 닫는다.
	// @param _handle: 실행 핸들
	// @param _path: 스크립트 경로
	// @param _argv: 넘길 인자
	private async WatchAsync(_handle: IRunningHandle, _path: string, _argv: string[]): Promise<IRunRecord>
	{
		const record = _handle.Record;
		try
		{
			// 이전 실행의 출력이 남아 있으면 수집기가 이번 실행 출력으로 읽는다. 시작 알림 전에 비운다.
			await this.launcher_.ResetLogAsync(_handle.EntryId);
		}
		catch (_err: unknown)
		{
			this.logger_.Warn("[ScriptRunner] 출력 파일 비우기 실패", { Id: _handle.EntryId, Error: String(_err) });
		}
		this.EmitRun({ Kind: "Started", EntryId: _handle.EntryId, Title: _handle.Title, Record: record });
		try
		{
			const result = await this.launcher_.LaunchAsync({
				EntryId: _handle.EntryId,
				RunToken: _handle.RunToken,
				Path: _path,
				Args: _argv,
				Signal: _handle.Controller.signal,
			});
			record.ExitCode = result.Code;
			if (_handle.StopRequested)
				record.Result = "Stopped";
			else
				record.Result = result.Code === 0 ? "Success" : "Failed";
			const stderr = result.Stderr.trim();
			// "#< CLIXML"로 시작하면 PowerShell이 진행률 등을 직렬화한 것이라 사람이 읽을 오류가 아니다.
			if (record.Result === "Failed" && stderr.length > 0 && !stderr.startsWith("#< CLIXML"))
				record.Error = stderr.slice(0, 2000);
		}
		catch (_err: unknown)
		{
			record.Result = _handle.StopRequested ? "Stopped" : "Error";
			record.Error = _err instanceof Error ? _err.message : String(_err);
		}
		record.EndedAtMs = this.now_.Now();
		this.running_.delete(_handle.EntryId);
		if (this.store_.Find(_handle.EntryId) !== null)
			this.store_.Save();
		this.logger_.Info("[ScriptRunner] 종료", { Id: _handle.EntryId, RunId: record.RunId, Result: record.Result, ExitCode: record.ExitCode });
		this.EmitRun({ Kind: "Finished", EntryId: _handle.EntryId, Title: _handle.Title, Record: record });
		this.Touch(false);
		return record;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 이벤트를 보낸다. 구독자 예외는 삼킨다.
	// @param _event: 이벤트
	private EmitRun(_event: TRunEvent): void
	{
		for (const handler of [...this.runListeners_])
		{
			try
			{
				handler(_event);
			}
			catch (_err: unknown)
			{
				this.logger_.Warn("[ScriptRunner] 실행 이벤트 처리 실패", { Error: String(_err) });
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋 값을 인자에 채우고 선택 상태를 바꾼다. 빈 이름은 "없음" 선택이다. 저장·알림은 호출자가 한다.
	// @param _entry: 항목
	// @param _name: 프리셋 이름(공백 정리됨)
	private static FillFromPreset(_entry: IScriptEntry, _name: string): TValuesOutcome
	{
		if (_name.length === 0)
		{
			_entry.SelectedPreset = "";
			return { Ok: true };
		}
		const preset = _entry.Presets.find((_p) => _p.Name === _name);
		if (preset === undefined)
			return { Ok: false, Error: `없는 프리셋입니다: ${_name} (저장된 프리셋: ${_entry.Presets.map((_p) => _p.Name).join(", ") || "없음"})` };
		for (const arg of _entry.Args)
		{
			const value = preset.Values[arg.Name];
			if (value !== undefined)
				arg.Value = value;
		}
		_entry.SelectedPreset = _name;
		return { Ok: true };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋 이름을 검사한다. 통과하면 "".
	// @param _name: 프리셋 이름(공백 정리됨)
	private static CheckPresetName(_name: string): string
	{
		if (_name.length === 0)
			return "프리셋 이름이 비어 있습니다.";
		if (_name === "없음")
			return "\"없음\"은 프리셋 이름으로 쓸 수 없습니다.";
		if (_name.length > kPresetNameMax)
			return `프리셋 이름은 ${kPresetNameMax}자 이하여야 합니다.`;
		return "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 정보를 검사한다. 통과하면 Ok.
	// @param _spec: 등록 정보
	private CheckSpec(_spec: IEntrySpec): TValuesOutcome
	{
		if (CleanPath(_spec.Path).length === 0)
			return { Ok: false, Error: "스크립트 경로가 비어 있습니다. 실행할 파일 경로를 입력하세요. (예: C:\\Tools\\build.ps1)" };
		const names = new Set<string>();
		for (let idx = 0; idx < _spec.Args.length; ++idx)
		{
			const name = (_spec.Args[idx] as IScriptArg).Name.trim();
			if (name.length === 0)
				return { Ok: false, Error: `${idx + 1}번째 인자의 이름이 비어 있습니다.` };
			if (names.has(name))
				return { Ok: false, Error: `인자 이름이 겹칩니다: ${name}` };
			names.add(name);
		}
		return { Ok: true };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 변경 알림을 보낸다. 구조가 바뀌었으면 Revision을 올린다. 구독자 예외는 삼킨다.
	// @param _structural: 목록 구조가 바뀌었는지
	private Touch(_structural: boolean): void
	{
		if (_structural)
			++this.revision_;
		for (const handler of [...this.listeners_])
		{
			try
			{
				handler();
			}
			catch (_err: unknown)
			{
				this.logger_.Warn("[ScriptRunner] 변경 알림 처리 실패", { Error: String(_err) });
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 넘길 위치 인자를 만든다. 가운데 빈 값은 빈 문자열로 자리를 지켜 뒤 인자가 앞으로 밀리지 않게 하고,
	// 끝쪽의 빈 값만 뺀다(스크립트 쪽 기본값이 먹도록).
	// @param _args: 인자 정의
	private static PositionalArgs(_args: ReadonlyArray<IScriptArg>): string[]
	{
		const values = _args.map((_a) => _a.Value.trim());
		while (values.length > 0 && values[values.length - 1] === "")
			values.pop();
		return values;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인자 정의의 이름·값 공백을 정리한 복제본을 만든다.
	// @param _args: 인자 목록
	private static TrimArgs(_args: ReadonlyArray<IScriptArg>): IScriptArg[]
	{
		return CloneArgs(_args).map((_a) => ({ Name: _a.Name.trim(), Required: _a.Required, Value: _a.Value }));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인자 값을 넣는다. 객체면 이름으로, 배열이면 순서대로 넣는다. 없는 이름·초과 개수는 거부한다.
	// @param _args: 대상 인자 목록(그대로 고친다)
	// @param _values: 넣을 값
	private static ApplyValues(_args: IScriptArg[], _values: TArgValues): TValuesOutcome
	{
		if (Array.isArray(_values))
		{
			if (_values.length > _args.length)
				return { Ok: false, Error: `인자 값이 ${_values.length}개인데 정의된 인자는 ${_args.length}개입니다.` };
			_values.forEach((_value, _idx) => { (_args[_idx] as IScriptArg).Value = _value; });
			return { Ok: true };
		}
		const unknown = Object.keys(_values).filter((_name) => !_args.some((_a) => _a.Name === _name));
		if (unknown.length > 0)
			return { Ok: false, Error: `없는 인자 이름입니다: ${unknown.join(", ")} (정의된 인자: ${_args.map((_a) => _a.Name).join(", ") || "없음"})` };
		for (const arg of _args)
		{
			const value = _values[arg.Name];
			if (value !== undefined)
				arg.Value = value;
		}
		return { Ok: true };
	}
}
