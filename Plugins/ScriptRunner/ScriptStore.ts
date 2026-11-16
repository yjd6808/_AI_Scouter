/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScriptStore. 스크립트 항목 영속 저장소. 상태 전체를 키 1개("State")에 담는다.
	      항목 객체는 저장소가 소유하고 엔진이 고친 뒤 Save()로 저장을 예약한다.
	      저장 파일을 사람이 손대도 깨지지 않도록 읽을 때 필드를 하나씩 검사해 굳힌다.
*/

import type { IArgPreset, IPersistState, IRunRecord, IScriptArg, IScriptEntry, IScriptSchedule, IScriptStorage, TRunResult, TRunTrigger } from "./Types";

const kStateKey = "State";
const kDefaultTitlePrefix = "스크립트-";
const kDefaultTitleRe = /^스크립트-(\d+)$/;
const kTriggers: ReadonlyArray<TRunTrigger> = ["Manual", "Schedule", "Mcp"];
const kResults: ReadonlyArray<TRunResult> = ["Running", "Success", "Failed", "Stopped", "Error"];

//////////////////////////////////////////////////////////////////////////////////////
// 레코드 모양인지 본다.
// @param _value: 검사 대상
function AsRecord(_value: unknown): Record<string, unknown> | null
{
	return typeof _value === "object" && _value !== null && !Array.isArray(_value) ? _value as Record<string, unknown> : null;
}

//////////////////////////////////////////////////////////////////////////////////////
// 문자열 필드를 읽는다. 아니면 기본값.
// @param _record: 레코드
// @param _key: 키
// @param _def: 기본값
function ReadString(_record: Record<string, unknown>, _key: string, _def: string): string
{
	const value = _record[_key];
	return typeof value === "string" ? value : _def;
}

//////////////////////////////////////////////////////////////////////////////////////
// 숫자 필드를 읽는다. 유한수가 아니면 기본값.
// @param _record: 레코드
// @param _key: 키
// @param _def: 기본값
function ReadNumber(_record: Record<string, unknown>, _key: string, _def: number): number
{
	const value = _record[_key];
	return typeof value === "number" && Number.isFinite(value) ? value : _def;
}

//////////////////////////////////////////////////////////////////////////////////////
// 불리언 필드를 읽는다. 아니면 기본값.
// @param _record: 레코드
// @param _key: 키
// @param _def: 기본값
function ReadBool(_record: Record<string, unknown>, _key: string, _def: boolean): boolean
{
	const value = _record[_key];
	return typeof value === "boolean" ? value : _def;
}

//////////////////////////////////////////////////////////////////////////////////////
// 인자 정의를 복제한다. 화면·Tool이 넘긴 배열을 그대로 붙잡지 않게 한다.
// @param _args: 인자 목록
export function CloneArgs(_args: ReadonlyArray<IScriptArg>): IScriptArg[]
{
	return _args.map((_a) => ({ Name: _a.Name, Required: _a.Required, Value: _a.Value }));
}

//////////////////////////////////////////////////////////////////////////////////////
// 예약 설정을 복제한다.
// @param _schedule: 예약 설정
export function CloneSchedule(_schedule: IScriptSchedule): IScriptSchedule
{
	return { Enabled: _schedule.Enabled, Kind: _schedule.Kind, OffsetSec: _schedule.OffsetSec, AtTime: _schedule.AtTime, Repeat: _schedule.Repeat };
}

//////////////////////////////////////////////////////////////////////////////////////
// 예약이 꺼진 기본 설정을 만든다.
export function EmptySchedule(): IScriptSchedule
{
	return { Enabled: false, Kind: "After", OffsetSec: 0, AtTime: "", Repeat: false };
}

export class ScriptStore
{
	// ==================== 멤버 ====================
	private readonly storage_: IScriptStorage;
	private readonly state_: IPersistState;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소에서 상태를 읽어 굳힌다.
	// @param _storage: 키-값 저장소
	public constructor(_storage: IScriptStorage)
	{
		this.storage_ = _storage;
		this.state_ = ScriptStore.Normalize(_storage.Get<unknown>(kStateKey, null));
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 목록을 등록 순으로 돌려준다. 배열은 복사본이지만 항목 객체는 저장소 소유다.
	public List(): IScriptEntry[]
	{
		return [...this.state_.Entries];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Id로 항목을 찾는다. 없으면 null.
	// @param _id: 항목 Id
	public Find(_id: string): IScriptEntry | null
	{
		return this.state_.Entries.find((_e) => _e.Id === _id) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 새 항목 Id를 발급한다. 지운 Id를 다시 쓰지 않도록 일련번호를 저장한다.
	public NewId(): string
	{
		this.state_.Seq += 1;
		this.Save();
		return `s${this.state_.Seq}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 끝에 붙이고 저장한다.
	// @param _entry: 항목
	public Add(_entry: IScriptEntry): void
	{
		this.state_.Entries.push(_entry);
		this.Save();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 지운다. 지웠으면 true.
	// @param _id: 항목 Id
	public Remove(_id: string): boolean
	{
		const idx = this.state_.Entries.findIndex((_e) => _e.Id === _id);
		if (idx < 0)
			return false;
		this.state_.Entries.splice(idx, 1);
		this.Save();
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 마지막으로 본 부팅 표식(로그인 세션 시작 시각, epoch ms). 없으면 0.
	public get BootMarkMs(): number
	{
		return this.state_.BootMarkMs;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 부팅 표식을 기록한다.
	// @param _ms: 로그인 세션 시작 시각(epoch ms)
	public SetBootMarkMs(_ms: number): void
	{
		this.state_.BootMarkMs = _ms;
		this.Save();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태 전체 저장을 예약한다. 실제 디스크 쓰기는 저장소가 모아서 한다.
	public Save(): void
	{
		this.storage_.Set(kStateKey, this.state_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 비어 있는 기본 제목 "스크립트-N"을 만든다. N은 기존 기본 제목 번호 중 최댓값 + 1이다.
	public DefaultTitle(): string
	{
		let max = 0;
		for (const entry of this.state_.Entries)
		{
			const match = kDefaultTitleRe.exec(entry.Title);
			if (match !== null)
				max = Math.max(max, Number(match[1]));
		}
		return `${kDefaultTitlePrefix}${max + 1}`;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장된 값을 상태로 굳힌다. 모양이 틀린 항목은 버린다.
	// @param _raw: 저장된 값
	private static Normalize(_raw: unknown): IPersistState
	{
		const record = AsRecord(_raw);
		const state: IPersistState = { SchemaVersion: 1, Seq: 0, BootMarkMs: 0, Entries: [] };
		if (record === null)
			return state;
		state.Seq = Math.max(0, Math.floor(ReadNumber(record, "Seq", 0)));
		state.BootMarkMs = Math.max(0, ReadNumber(record, "BootMarkMs", 0));
		const entries = record["Entries"];
		if (!Array.isArray(entries))
			return state;
		for (const item of entries)
		{
			const entry = ScriptStore.NormalizeEntry(item);
			if (entry !== null && state.Entries.every((_e) => _e.Id !== entry.Id))
				state.Entries.push(entry);
		}
		return state;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 1개를 굳힌다. Id·경로가 없으면 null.
	// @param _raw: 저장된 항목
	private static NormalizeEntry(_raw: unknown): IScriptEntry | null
	{
		const record = AsRecord(_raw);
		if (record === null)
			return null;
		const id = ReadString(record, "Id", "");
		const path = ReadString(record, "Path", "");
		if (id.length === 0 || path.length === 0)
			return null;
		const args: IScriptArg[] = [];
		const rawArgs = record["Args"];
		if (Array.isArray(rawArgs))
		{
			for (const item of rawArgs)
			{
				const arg = AsRecord(item);
				if (arg !== null)
					args.push({ Name: ReadString(arg, "Name", ""), Required: ReadBool(arg, "Required", false), Value: ReadString(arg, "Value", "") });
			}
		}
		return {
			Id: id,
			Title: ReadString(record, "Title", id),
			Path: path,
			Args: args,
			Schedule: ScriptStore.NormalizeSchedule(record["Schedule"]),
			// 이 필드가 생기기 전에 저장된 항목은 예약이 늘 유지됐으므로 켜짐으로 읽어 동작을 바꾸지 않는다.
			KeepAfterBoot: ReadBool(record, "KeepAfterBoot", true),
			Presets: ScriptStore.NormalizePresets(record["Presets"]),
			SelectedPreset: ReadString(record, "SelectedPreset", ""),
			NextDueAtMs: Math.max(0, ReadNumber(record, "NextDueAtMs", 0)),
			MissedAtMs: Math.max(0, ReadNumber(record, "MissedAtMs", 0)),
			CreatedAtMs: ReadNumber(record, "CreatedAtMs", 0),
			UpdatedAtMs: ReadNumber(record, "UpdatedAtMs", 0),
			RunCount: Math.max(0, Math.floor(ReadNumber(record, "RunCount", 0))),
			LastRun: ScriptStore.NormalizeRun(record["LastRun"]),
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋 목록을 굳힌다. 이름이 없거나 겹치는 프리셋은 버리고, 값은 문자열만 남긴다.
	// @param _raw: 저장된 프리셋 목록
	private static NormalizePresets(_raw: unknown): IArgPreset[]
	{
		const presets: IArgPreset[] = [];
		if (!Array.isArray(_raw))
			return presets;
		for (const item of _raw)
		{
			const record = AsRecord(item);
			if (record === null)
				continue;
			const name = ReadString(record, "Name", "").trim();
			if (name.length === 0 || presets.some((_p) => _p.Name === name))
				continue;
			const values: Record<string, string> = {};
			const rawValues = AsRecord(record["Values"]);
			if (rawValues !== null)
			{
				for (const [key, value] of Object.entries(rawValues))
				{
					if (typeof value === "string")
						values[key] = value;
				}
			}
			presets.push({ Name: name, Values: values });
		}
		return presets;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 설정을 굳힌다.
	// @param _raw: 저장된 예약 설정
	private static NormalizeSchedule(_raw: unknown): IScriptSchedule
	{
		const record = AsRecord(_raw);
		if (record === null)
			return EmptySchedule();
		return {
			Enabled: ReadBool(record, "Enabled", false),
			Kind: record["Kind"] === "At" ? "At" : "After",
			OffsetSec: Math.max(0, ReadNumber(record, "OffsetSec", 0)),
			AtTime: ReadString(record, "AtTime", ""),
			Repeat: ReadBool(record, "Repeat", false),
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 기록을 굳힌다. 없거나 모양이 틀리면 null.
	// @param _raw: 저장된 실행 기록
	private static NormalizeRun(_raw: unknown): IRunRecord | null
	{
		const record = AsRecord(_raw);
		if (record === null)
			return null;
		const trigger = ReadString(record, "Trigger", "Manual");
		const result = ReadString(record, "Result", "Error");
		const args = record["Args"];
		return {
			RunId: ReadString(record, "RunId", ""),
			Trigger: kTriggers.includes(trigger as TRunTrigger) ? trigger as TRunTrigger : "Manual",
			StartedAtMs: ReadNumber(record, "StartedAtMs", 0),
			EndedAtMs: ReadNumber(record, "EndedAtMs", 0),
			ExitCode: ReadNumber(record, "ExitCode", -1),
			Result: kResults.includes(result as TRunResult) ? result as TRunResult : "Error",
			Args: Array.isArray(args) ? args.filter((_a): _a is string => typeof _a === "string") : [],
			Error: ReadString(record, "Error", ""),
		};
	}
}
