/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: AlarmStore. 그룹·예약 CRUD와 영속화. 저장소는 인터페이스로 주입받아 테스트 대역을 끼울 수 있다.
	      저장하는 시간 값은 DueAtMs(절대 epoch ms) 하나뿐이고 남은 시간은 저장하지 않는다.
*/

import type { IAlarmGroup, IAlarmSpec, IAlarmStorage, IArmedAlarm, INowSource, IPersistState, TAlarmKind, TAlarmState, TAlarmUiKind } from "./Types";

const kStateKey = "State";
const kGroupsKey = "Groups";
const kSeenPersistMs = 15000;
const kDayMs = 86400000;
const kAlarmKinds: ReadonlyArray<string> = ["After", "At"];
const kAlarmStates: ReadonlyArray<string> = ["Idle", "Armed", "Fired", "Missed", "Canceled"];
const kUiKinds: ReadonlyArray<string> = ["ok", "yesno"];
const kClosedStates: ReadonlyArray<TAlarmState> = ["Fired", "Missed", "Canceled"];

//////////////////////////////////////////////////////////////////////////////////////
// unknown을 레코드로 좁힌다. 객체가 아니면 null.
// @param _value: 검사 대상
function AsRecord(_value: unknown): Record<string, unknown> | null
{
	if (typeof _value !== "object" || _value === null || Array.isArray(_value))
		return null;
	return _value as Record<string, unknown>;
}

//////////////////////////////////////////////////////////////////////////////////////
// 문자열을 꺼낸다. 아니면 기본값.
// @param _record: 원본 레코드
// @param _key: 키
// @param _def: 기본값
function AsText(_record: Record<string, unknown>, _key: string, _def: string): string
{
	const value = _record[_key];
	return typeof value === "string" ? value : _def;
}

//////////////////////////////////////////////////////////////////////////////////////
// 유한 숫자를 꺼낸다. 아니면 기본값.
// @param _record: 원본 레코드
// @param _key: 키
// @param _def: 기본값
function AsNumber(_record: Record<string, unknown>, _key: string, _def: number): number
{
	const value = _record[_key];
	return typeof value === "number" && Number.isFinite(value) ? value : _def;
}

//////////////////////////////////////////////////////////////////////////////////////
// 불린을 꺼낸다. 아니면 기본값.
// @param _record: 원본 레코드
// @param _key: 키
// @param _def: 기본값
function AsFlag(_record: Record<string, unknown>, _key: string, _def: boolean): boolean
{
	const value = _record[_key];
	return typeof value === "boolean" ? value : _def;
}

//////////////////////////////////////////////////////////////////////////////////////
// 알람 스펙을 복사한다. 예약 시 스냅샷을 뜨는 용도라 원본 수정·삭제와 끊어진다.
// @param _spec: 원본 스펙
export function CloneSpec(_spec: IAlarmSpec): IAlarmSpec
{
	return {
		Id: _spec.Id,
		Kind: _spec.Kind,
		Title: _spec.Title,
		Message: _spec.Message,
		OffsetSec: _spec.OffsetSec,
		AtTime: _spec.AtTime,
		RollToNextDay: _spec.RollToNextDay,
		KindUi: _spec.KindUi,
		DurationSec: _spec.DurationSec,
		Topmost: _spec.Topmost,
		WithToast: _spec.WithToast,
	};
}

//////////////////////////////////////////////////////////////////////////////////////
// 저장소에서 읽은 값을 스펙으로 굳힌다. 모양이 깨졌으면 null.
// @param _raw: 저장소 원본
export function NormalizeSpec(_raw: unknown): IAlarmSpec | null
{
	const record = AsRecord(_raw);
	if (record === null)
		return null;
	const id = AsText(record, "Id", "");
	if (id.length === 0)
		return null;
	const kind = AsText(record, "Kind", "After");
	const uiKind = AsText(record, "KindUi", "ok");
	return {
		Id: id,
		Kind: (kAlarmKinds.includes(kind) ? kind : "After") as TAlarmKind,
		Title: AsText(record, "Title", ""),
		Message: AsText(record, "Message", ""),
		OffsetSec: AsNumber(record, "OffsetSec", 0),
		AtTime: AsText(record, "AtTime", ""),
		RollToNextDay: AsFlag(record, "RollToNextDay", false),
		KindUi: (kUiKinds.includes(uiKind) ? uiKind : "ok") as TAlarmUiKind,
		DurationSec: AsNumber(record, "DurationSec", 0),
		Topmost: AsFlag(record, "Topmost", true),
		WithToast: AsFlag(record, "WithToast", false),
	};
}

//////////////////////////////////////////////////////////////////////////////////////
// 저장소에서 읽은 값을 예약 인스턴스로 굳힌다. DueAtMs가 없으면 버린다.
// @param _raw: 저장소 원본
export function NormalizeArmed(_raw: unknown): IArmedAlarm | null
{
	const record = AsRecord(_raw);
	if (record === null)
		return null;
	const id = AsText(record, "Id", "");
	const due = AsNumber(record, "DueAtMs", 0);
	if (id.length === 0 || due <= 0)
		return null;
	const spec = NormalizeSpec(record["Spec"]);
	if (spec === null)
		return null;
	const state = AsText(record, "State", "Armed");
	return {
		Id: id,
		SpecId: AsText(record, "SpecId", spec.Id),
		Spec: spec,
		GroupName: AsText(record, "GroupName", ""),
		ArmedAtMs: AsNumber(record, "ArmedAtMs", 0),
		DueAtMs: due,
		State: (kAlarmStates.includes(state) ? state : "Armed") as TAlarmState,
		FiredAtMs: AsNumber(record, "FiredAtMs", 0),
		Result: AsText(record, "Result", ""),
		MissedNotified: AsFlag(record, "MissedNotified", false),
	};
}

//////////////////////////////////////////////////////////////////////////////////////
// 저장소에서 읽은 값을 영속 상태로 굳힌다. 깨진 항목은 버리고 나머지를 살린다.
// @param _raw: 저장소 원본
export function NormalizeState(_raw: unknown): IPersistState
{
	const state: IPersistState = { SchemaVersion: 1, Armed: [], LastSeenAtMs: 0 };
	const record = AsRecord(_raw);
	if (record === null)
		return state;
	const list = record["Armed"];
	if (Array.isArray(list))
	{
		for (const item of list as unknown[])
		{
			const armed = NormalizeArmed(item);
			if (armed !== null)
				state.Armed.push(armed);
		}
	}
	state.LastSeenAtMs = AsNumber(record, "LastSeenAtMs", 0);
	return state;
}

export class AlarmStore
{
	// ==================== 멤버 ====================
	private readonly storage_: IAlarmStorage;
	private readonly now_: INowSource;
	private readonly state_: IPersistState;
	private groups_: IAlarmGroup[];
	private seenPersistedMs_: number;
	private idSeq_ = 0;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소와 시계를 주입받고 즉시 이전 상태를 복원한다.
	// @param _storage: 키-값 저장소(ctx.Storage 호환)
	// @param _now: 현재 시각 공급자
	public constructor(_storage: IAlarmStorage, _now: INowSource)
	{
		this.storage_ = _storage;
		this.now_ = _now;
		this.state_ = NormalizeState(_storage.Get<unknown>(kStateKey, null));
		this.groups_ = this.LoadGroups();
		this.seenPersistedMs_ = this.state_.LastSeenAtMs;
	}

	// ==================== 속성 ====================
	public get LastSeenAtMs(): number { return this.state_.LastSeenAtMs; }
	public get SchemaVersion(): number { return this.state_.SchemaVersion; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 목록을 이름순으로 돌려준다.
	public ListGroups(): IAlarmGroup[]
	{
		return [...this.groups_].sort((_a, _b) => _a.Name.localeCompare(_b.Name));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Id로 그룹을 찾는다. 없으면 null.
	// @param _id: 그룹 Id
	public FindGroup(_id: string): IAlarmGroup | null
	{
		return this.groups_.find((_g) => _g.Id === _id) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름으로 그룹을 찾는다. 없으면 null.
	// @param _name: 그룹 이름
	public FindGroupByName(_name: string): IAlarmGroup | null
	{
		return this.groups_.find((_g) => _g.Name === _name) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹을 추가하거나 덮어쓴다. 즉시 저장한다.
	// @param _group: 그룹
	public SaveGroup(_group: IAlarmGroup): void
	{
		const next = this.groups_.filter((_g) => _g.Id !== _group.Id);
		next.push(_group);
		this.groups_ = next;
		this.SaveGroups();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹을 지운다. 지웠으면 true. 예약된 알람은 스냅샷이라 영향 없다.
	// @param _id: 그룹 Id
	public RemoveGroup(_id: string): boolean
	{
		const next = this.groups_.filter((_g) => _g.Id !== _id);
		if (next.length === this.groups_.length)
			return false;
		this.groups_ = next;
		this.SaveGroups();
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 목록을 마감 시각순으로 돌려준다. 요소는 살아 있는 참조다.
	public ListArmed(): IArmedAlarm[]
	{
		return [...this.state_.Armed].sort((_a, _b) => _a.DueAtMs - _b.DueAtMs);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Id로 예약을 찾는다. 없으면 null.
	// @param _id: 예약 인스턴스 Id
	public FindArmed(_id: string): IArmedAlarm | null
	{
		return this.state_.Armed.find((_a) => _a.Id === _id) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약을 추가하고 즉시 저장한다.
	// @param _alarm: 예약 인스턴스
	public AddArmed(_alarm: IArmedAlarm): void
	{
		this.state_.Armed.push(_alarm);
		this.Save();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약을 갱신하고 즉시 저장한다. 없으면 false.
	// @param _alarm: 예약 인스턴스
	public UpdateArmed(_alarm: IArmedAlarm): boolean
	{
		const idx = this.state_.Armed.findIndex((_a) => _a.Id === _alarm.Id);
		if (idx < 0)
			return false;
		this.state_.Armed[idx] = _alarm;
		this.Save();
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약을 지우고 즉시 저장한다. 지웠으면 true.
	// @param _id: 예약 인스턴스 Id
	public RemoveArmed(_id: string): boolean
	{
		const next = this.state_.Armed.filter((_a) => _a.Id !== _id);
		if (next.length === this.state_.Armed.length)
			return false;
		this.state_.Armed.length = 0;
		this.state_.Armed.push(...next);
		this.Save();
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 완료·취소·놓침 이력을 보관 기간이 지난 것부터 지운다. 지운 개수를 돌려준다.
	// @param _nowMs: 현재 시각
	// @param _keepDays: 보관 일수
	public PruneHistory(_nowMs: number, _keepDays: number): number
	{
		const limitMs = Math.max(0, _keepDays) * kDayMs;
		const kept = this.state_.Armed.filter((_a) =>
		{
			if (!kClosedStates.includes(_a.State))
				return true;
			const stamp = Math.max(_a.FiredAtMs, _a.DueAtMs);
			return _nowMs - stamp <= limitMs;
		});
		const removed = this.state_.Armed.length - kept.length;
		if (removed === 0)
			return 0;
		this.state_.Armed.length = 0;
		this.state_.Armed.push(...kept);
		this.Save();
		return removed;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 마지막 생존 시각을 갱신한다. 기록은 일정 주기로만 저장해 쓰기를 줄인다.
	// @param _nowMs: 현재 시각
	public TouchSeen(_nowMs: number): void
	{
		this.state_.LastSeenAtMs = _nowMs;
		if (Math.abs(_nowMs - this.seenPersistedMs_) < kSeenPersistMs)
			return;
		this.Save();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 상태를 저장소에 곧바로 기록한다. 상태 변화 시점마다 호출한다.
	public Save(): void
	{
		this.seenPersistedMs_ = this.state_.LastSeenAtMs;
		this.storage_.Set(kStateKey, this.state_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 목록을 저장소에 곧바로 기록한다.
	public SaveGroups(): void
	{
		this.storage_.Set(kGroupsKey, this.groups_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 충돌하지 않는 Id를 만든다. 시각 + 일련번호 조합.
	// @param _prefix: 접두어
	public NewId(_prefix: string): string
	{
		this.idSeq_ += 1;
		return `${_prefix}-${this.now_.Now().toString(36)}-${this.idSeq_}`;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소의 그룹을 읽어 굳힌다. 깨진 항목은 버린다.
	private LoadGroups(): IAlarmGroup[]
	{
		const raw = this.storage_.Get<unknown>(kGroupsKey, null);
		if (!Array.isArray(raw))
			return [];
		const out: IAlarmGroup[] = [];
		for (const item of raw as unknown[])
		{
			const record = AsRecord(item);
			if (record === null)
				continue;
			const id = AsText(record, "Id", "");
			if (id.length === 0)
				continue;
			const specs: IAlarmSpec[] = [];
			const rawSpecs = record["Specs"];
			if (Array.isArray(rawSpecs))
			{
				for (const rawSpec of rawSpecs as unknown[])
				{
					const spec = NormalizeSpec(rawSpec);
					if (spec !== null)
						specs.push(spec);
				}
			}
			out.push({ Id: id, Name: AsText(record, "Name", id), Description: AsText(record, "Description", ""), Specs: specs });
		}
		return out;
	}
}
