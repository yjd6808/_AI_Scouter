/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: InstantAlarm 엔진 테스트. 가짜 저장소 + 가짜 시계 + 가짜 발사 싱크라 실시간 대기가 없다.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AlarmEngine, ParseAtTime, ResolveDueAtMs } from "../../../../Plugins/InstantAlarm/AlarmEngine";
import { AlarmStore } from "../../../../Plugins/InstantAlarm/AlarmStore";
import { AlarmFormat } from "../../../../Plugins/InstantAlarm/AlarmFormat";
import { SpecFactory } from "../../../../Plugins/InstantAlarm/SpecFactory";
import type { IAlarmGroup, IAlarmOptions, IAlarmSpec, IAlarmStorage, IArmedAlarm, IPersistState, TAlarmResult, TArmOutcome, TMissedPolicy } from "../../../../Plugins/InstantAlarm/Types";

interface IOptionValues
{
	DefaultDurationSec: number;
	DefaultTopmost: boolean;
	TickMs: number;
	MissedPolicy: TMissedPolicy;
	MissedGraceSec: number;
	MissedListMax: number;
	HistoryKeepDays: number;
	UrgentSec: number;
	DefaultGroup: string;
}

interface IFireTrace
{
	State: string;
	FiredAtMs: number;
}

interface IMissedCall
{
	List: IArmedAlarm[];
	Total: number;
}

interface IHarness
{
	Data: Map<string, string>;
	Clock: { NowMs: number };
	Values: IOptionValues;
	Control: { Result: TAlarmResult };
	Store: AlarmStore;
	Engine: AlarmEngine;
	Fired: IArmedAlarm[];
	SeenAtFire: IFireTrace[];
	MissedCalls: IMissedCall[];
	Warns: string[];
}

const kBaseMs = new Date(2026, 8, 16, 10, 0, 0, 0).getTime();

function MemoryStorage(_data: Map<string, string>): IAlarmStorage
{
	return {
		Get: <T>(_key: string, _def: T): T =>
		{
			const raw = _data.get(_key);
			return raw === undefined ? _def : JSON.parse(raw) as T;
		},
		Set: (_key: string, _value: unknown): void => { _data.set(_key, JSON.stringify(_value)); },
		Delete: (_key: string): void => { _data.delete(_key); },
	};
}

function DefaultValues(): IOptionValues
{
	return {
		DefaultDurationSec: 0, DefaultTopmost: true, TickMs: 1000, MissedPolicy: "toast",
		MissedGraceSec: 0, MissedListMax: 3, HistoryKeepDays: 7, UrgentSec: 60, DefaultGroup: "",
	};
}

function MakeOptions(_values: IOptionValues): IAlarmOptions
{
	return {
		DefaultDurationSec: () => _values.DefaultDurationSec,
		DefaultTopmost: () => _values.DefaultTopmost,
		TickMs: () => _values.TickMs,
		MissedPolicy: () => _values.MissedPolicy,
		MissedGraceSec: () => _values.MissedGraceSec,
		MissedListMax: () => _values.MissedListMax,
		HistoryKeepDays: () => _values.HistoryKeepDays,
		UrgentSec: () => _values.UrgentSec,
		DefaultGroup: () => _values.DefaultGroup,
	};
}

function MakeSpec(_id: string, _patch: Partial<IAlarmSpec>): IAlarmSpec
{
	return {
		Id: _id,
		Kind: "After",
		Title: _id,
		Message: "",
		OffsetSec: 60,
		AtTime: "",
		RollToNextDay: false,
		KindUi: "ok",
		DurationSec: 0,
		Topmost: true,
		WithToast: false,
		..._patch,
	};
}

function MakeArmed(_id: string, _patch: Partial<IArmedAlarm>): IArmedAlarm
{
	return {
		Id: _id,
		SpecId: `spec-${_id}`,
		Spec: MakeSpec(`spec-${_id}`, {}),
		GroupName: "",
		ArmedAtMs: kBaseMs,
		DueAtMs: kBaseMs,
		State: "Armed",
		FiredAtMs: 0,
		Result: "",
		MissedNotified: false,
		..._patch,
	};
}

function SeedState(_data: Map<string, string>, _armed: IArmedAlarm[], _lastSeenMs: number): Map<string, string>
{
	const state: IPersistState = { SchemaVersion: 1, Armed: _armed, LastSeenAtMs: _lastSeenMs };
	_data.set("State", JSON.stringify(state));
	return _data;
}

function ReadPersisted(_data: Map<string, string>): IPersistState
{
	const raw = _data.get("State");
	if (raw === undefined)
		throw new Error("저장된 상태 없음");
	return JSON.parse(raw) as IPersistState;
}

function RequireFirst(_list: IArmedAlarm[]): IArmedAlarm
{
	const found = _list[0];
	if (found === undefined)
		throw new Error("목록이 비어 있음");
	return found;
}

function RequireAlarm(_outcome: TArmOutcome): IArmedAlarm
{
	if (!_outcome.Ok)
		throw new Error(`예약 실패: ${_outcome.Error}`);
	return _outcome.Alarm;
}

function MakeHarness(_startMs: number, _data: Map<string, string>): IHarness
{
	const clock = { NowMs: _startMs };
	const control: { Result: TAlarmResult } = { Result: "ok" };
	const values = DefaultValues();
	const fired: IArmedAlarm[] = [];
	const seenAtFire: IFireTrace[] = [];
	const missedCalls: IMissedCall[] = [];
	const warns: string[] = [];
	const storage = MemoryStorage(_data);
	const now = { Now: () => clock.NowMs };
	const store = new AlarmStore(storage, now);
	const engine = new AlarmEngine({
		Store: store,
		Now: now,
		Fire: (_alarm) =>
		{
			fired.push(_alarm);
			const found = ReadPersisted(_data).Armed.find((_a) => _a.Id === _alarm.Id);
			seenAtFire.push({ State: found?.State ?? "없음", FiredAtMs: found?.FiredAtMs ?? -1 });
			return Promise.resolve(control.Result);
		},
		Missed: (_missed, _total) => { missedCalls.push({ List: _missed, Total: _total }); },
		Options: MakeOptions(values),
		Logger: {
			Info: () => undefined,
			Warn: (_msg: string) => { warns.push(_msg); },
		},
	});
	return {
		Data: _data, Clock: clock, Values: values, Control: control, Store: store, Engine: engine,
		Fired: fired, SeenAtFire: seenAtFire, MissedCalls: missedCalls, Warns: warns,
	};
}

void describe("InstantAlarm", () =>
{
	void it("시각 문자열을 분해한다", () =>
	{
		assert.equal(ParseAtTime("09:30")?.Hour, 9);
		assert.equal(ParseAtTime("09:30")?.HasDate, false);
		assert.equal(ParseAtTime("2026-09-17 23:05")?.Day, 17);
		assert.equal(ParseAtTime("2026-09-17 23:05")?.HasDate, true);
		assert.equal(ParseAtTime("25:00"), null);
		assert.equal(ParseAtTime("9시 30분"), null);
	});

	void it("(a) 재기동해도 DueAtMs가 그대로고 남은 시간만 줄어든다", () =>
	{
		const data = new Map<string, string>();
		const first = MakeHarness(kBaseMs, data);
		const armed = RequireAlarm(first.Engine.ArmSpec(MakeSpec("s1", { Kind: "After", OffsetSec: 600 }), ""));
		assert.equal(armed.DueAtMs, kBaseMs + 600000);
		assert.equal(first.Engine.RemainingMs(armed), 600000);

		const second = MakeHarness(kBaseMs + 300000, data);
		const reloaded = RequireFirst(second.Store.ListArmed());
		assert.equal(reloaded.DueAtMs, armed.DueAtMs);
		assert.equal(reloaded.State, "Armed");
		assert.equal(second.Engine.RemainingMs(reloaded), 300000);
	});

	void it("(b) Armed + 마감 경과 + 미발사면 놓침으로 분류한다", () =>
	{
		const data = new Map<string, string>();
		const first = MakeHarness(kBaseMs, data);
		first.Engine.ArmSpec(MakeSpec("s1", { Kind: "After", OffsetSec: 600 }), "");

		const second = MakeHarness(kBaseMs + 3600000, data);
		const report = second.Engine.Restore();
		assert.equal(report.ClockBack, false);
		assert.equal(report.Missed.length, 1);
		assert.equal(RequireFirst(second.Store.ListArmed()).State, "Missed");
		assert.equal(second.MissedCalls.length, 1);
		assert.equal(RequireFirst(ReadPersisted(data).Armed).State, "Missed");
	});

	void it("(c) 이미 울린 건(FiredAtMs > 0)은 놓침이 아니고 결과가 closed로 마감된다", () =>
	{
		const data = SeedState(new Map<string, string>(), [
			MakeArmed("a1", { State: "Armed", DueAtMs: kBaseMs - 600000, FiredAtMs: kBaseMs - 599000 }),
			MakeArmed("a2", { State: "Fired", DueAtMs: kBaseMs - 500000, FiredAtMs: kBaseMs - 499000, Result: "" }),
		], 0);
		const harness = MakeHarness(kBaseMs, data);
		const report = harness.Engine.Restore();
		assert.equal(report.Missed.length, 0);
		assert.equal(harness.MissedCalls.length, 0);
		const stored = ReadPersisted(data).Armed;
		assert.equal(stored.find((_a) => _a.Id === "a1")?.State, "Armed");
		assert.equal(stored.find((_a) => _a.Id === "a2")?.Result, "closed");
	});

	void it("(d) 이미 안내한 놓침은 재기동해도 다시 안내하지 않는다", () =>
	{
		const data = SeedState(new Map<string, string>(), [
			MakeArmed("a1", { State: "Armed", DueAtMs: kBaseMs - 600000 }),
		], 0);
		const first = MakeHarness(kBaseMs, data);
		assert.equal(first.Engine.Restore().Notified, 1);
		assert.equal(first.MissedCalls.length, 1);
		assert.equal(RequireFirst(ReadPersisted(data).Armed).MissedNotified, true);

		const second = MakeHarness(kBaseMs + 60000, data);
		assert.equal(second.Engine.Restore().Notified, 0);
		assert.equal(second.MissedCalls.length, 0);
	});

	void it("(d-2) silent 정책이면 안내하지 않는다", () =>
	{
		const data = SeedState(new Map<string, string>(), [
			MakeArmed("a1", { State: "Armed", DueAtMs: kBaseMs - 600000 }),
		], 0);
		const harness = MakeHarness(kBaseMs, data);
		harness.Values.MissedPolicy = "silent";
		const report = harness.Engine.Restore();
		assert.equal(report.Missed.length, 1);
		assert.equal(report.Notified, 0);
		assert.equal(harness.MissedCalls.length, 0);
	});

	void it("(d-3) 안내 목록은 MissedListMax까지만 나열하고 총 건수를 함께 준다", () =>
	{
		const data = SeedState(new Map<string, string>(), [
			MakeArmed("a1", { State: "Armed", DueAtMs: kBaseMs - 600000 }),
			MakeArmed("a2", { State: "Armed", DueAtMs: kBaseMs - 500000 }),
			MakeArmed("a3", { State: "Armed", DueAtMs: kBaseMs - 400000 }),
		], 0);
		const harness = MakeHarness(kBaseMs, data);
		harness.Values.MissedListMax = 2;
		harness.Engine.Restore();
		const call = harness.MissedCalls[0];
		if (call === undefined)
			throw new Error("안내 호출이 없음");
		assert.equal(call.List.length, 2);
		assert.equal(call.Total, 3);
	});

	void it("(e) MissedGraceSec 이내 경과는 놓침이 아니라 정상 발사로 넘긴다", async () =>
	{
		const data = SeedState(new Map<string, string>(), [
			MakeArmed("a1", { State: "Armed", DueAtMs: kBaseMs - 30000 }),
			MakeArmed("a2", { State: "Armed", DueAtMs: kBaseMs - 31000 }),
		], 0);
		const harness = MakeHarness(kBaseMs, data);
		harness.Values.MissedGraceSec = 30;
		const report = harness.Engine.Restore();
		assert.deepStrictEqual(report.Grace.map((_a) => _a.Id), ["a1"]);
		assert.deepStrictEqual(report.Missed.map((_a) => _a.Id), ["a2"]);

		await harness.Engine.TickAsync();
		assert.deepStrictEqual(harness.Fired.map((_a) => _a.Id), ["a1"]);
	});

	void it("(f) 시계가 역행하면 놓침 판정을 보류하고 경고만 남긴다", () =>
	{
		const data = SeedState(new Map<string, string>(), [
			MakeArmed("a1", { State: "Armed", DueAtMs: kBaseMs - 600000 }),
		], kBaseMs + 7200000);
		const harness = MakeHarness(kBaseMs, data);
		const report = harness.Engine.Restore();
		assert.equal(report.ClockBack, true);
		assert.equal(report.Missed.length, 0);
		assert.equal(harness.MissedCalls.length, 0);
		assert.equal(RequireFirst(harness.Store.ListArmed()).State, "Armed");
		assert.equal(harness.Warns.length, 1);
	});

	void it("(g) 그룹 예약은 상대 알람을 재계산하고 절대 알람을 예약일 날짜에 붙인다", () =>
	{
		const data = new Map<string, string>();
		const harness = MakeHarness(kBaseMs, data);
		const group: IAlarmGroup = {
			Id: "g1",
			Name: "출근 세트",
			Description: "",
			Specs: [
				MakeSpec("s1", { Kind: "After", OffsetSec: 3600 }),
				MakeSpec("s2", { Kind: "At", AtTime: "23:30" }),
				MakeSpec("s3", { Kind: "At", AtTime: "09:00", RollToNextDay: true }),
			],
		};
		const report = harness.Engine.ArmGroup(group);
		assert.equal(report.Errors.length, 0);
		assert.equal(report.Armed.length, 3);
		const bySpec = new Map(report.Armed.map((_a) => [_a.SpecId, _a] as const));
		assert.equal(bySpec.get("s1")?.DueAtMs, kBaseMs + 3600000);
		assert.equal(bySpec.get("s2")?.DueAtMs, new Date(2026, 8, 16, 23, 30, 0, 0).getTime());
		assert.equal(bySpec.get("s3")?.DueAtMs, new Date(2026, 8, 17, 9, 0, 0, 0).getTime());
		assert.equal(bySpec.get("s1")?.GroupName, "출근 세트");
		assert.equal(harness.Store.ListArmed().length, 3);

		const later = MakeHarness(kBaseMs + 7200000, new Map<string, string>());
		const relative = RequireFirst(later.Engine.ArmGroup(group).Armed);
		assert.equal(relative.DueAtMs, kBaseMs + 7200000 + 3600000);
	});

	void it("(g-2) 예약된 알람은 스펙 스냅샷을 들고 있어 원본이 바뀌어도 그대로다", () =>
	{
		const harness = MakeHarness(kBaseMs, new Map<string, string>());
		const spec = MakeSpec("s1", { Kind: "After", OffsetSec: 600, Title: "원본" });
		const armed = RequireAlarm(harness.Engine.ArmSpec(spec, ""));
		spec.Title = "수정됨";
		spec.OffsetSec = 1;
		assert.equal(armed.Spec.Title, "원본");
		assert.equal(armed.DueAtMs, kBaseMs + 600000);
	});

	void it("(h) RollToNextDay가 false면 이미 지난 시각은 거부한다", () =>
	{
		const harness = MakeHarness(kBaseMs, new Map<string, string>());
		const outcome = harness.Engine.ArmSpec(MakeSpec("s1", { Kind: "At", AtTime: "09:00", RollToNextDay: false }), "");
		assert.equal(outcome.Ok, false);
		assert.equal(harness.Store.ListArmed().length, 0);
		assert.equal(harness.Warns.length, 1);

		const rolled = ResolveDueAtMs(MakeSpec("s2", { Kind: "At", AtTime: "09:00", RollToNextDay: true }), kBaseMs);
		assert.equal(rolled.Ok, true);
		const rejected = ResolveDueAtMs(MakeSpec("s3", { Kind: "After", OffsetSec: 0 }), kBaseMs);
		assert.equal(rejected.Ok, false);
	});

	void it("(i) 발사는 상태를 먼저 Fired로 저장한 뒤 싱크를 부른다", async () =>
	{
		const data = new Map<string, string>();
		const harness = MakeHarness(kBaseMs, data);
		const armed = RequireAlarm(harness.Engine.ArmSpec(MakeSpec("s1", { Kind: "After", OffsetSec: 60 }), ""));
		harness.Clock.NowMs = kBaseMs + 60000;
		await harness.Engine.TickAsync();
		assert.deepStrictEqual(harness.SeenAtFire, [{ State: "Fired", FiredAtMs: kBaseMs + 60000 }]);
		assert.equal(harness.Fired.length, 1);
		const stored = RequireFirst(ReadPersisted(data).Armed);
		assert.equal(stored.Id, armed.Id);
		assert.equal(stored.State, "Fired");
		assert.equal(stored.Result, "ok");

		harness.Clock.NowMs = kBaseMs + 120000;
		await harness.Engine.TickAsync();
		assert.equal(harness.Fired.length, 1);
	});

	void it("(j) 미루기는 Id를 그대로 두고 마감 시각만 뒤로 민다", () =>
	{
		const data = new Map<string, string>();
		const harness = MakeHarness(kBaseMs, data);
		const armed = RequireAlarm(harness.Engine.ArmSpec(MakeSpec("s1", { Kind: "After", OffsetSec: 600 }), ""));
		const moved = RequireAlarm(harness.Engine.Postpone(armed.Id, 300));
		// Id·SpecId가 그대로여야 목록에서 같은 줄로 남는다. 취소 후 재예약이면 Id가 바뀐다.
		assert.equal(moved.Id, armed.Id);
		assert.equal(moved.SpecId, armed.SpecId);
		assert.equal(moved.DueAtMs, kBaseMs + 600000 + 300000);
		assert.equal(harness.Store.ListArmed().length, 1);
		assert.equal(RequireFirst(ReadPersisted(data).Armed).DueAtMs, kBaseMs + 900000);

		// 마감을 넘겼지만 아직 안 울린 건은 지금을 기준으로 민다(과거로 밀지 않는다).
		harness.Clock.NowMs = kBaseMs + 1200000;
		const late = harness.Engine.Postpone(armed.Id, 60);
		assert.equal(late.Ok, true);
		assert.equal(harness.Engine.RemainingMs(armed), 60000);

		assert.equal(harness.Engine.Postpone(armed.Id, 0).Ok, false);
		assert.equal(harness.Engine.Postpone("없는-id", 300).Ok, false);
		harness.Engine.Cancel(armed.Id);
		assert.equal(harness.Engine.Postpone(armed.Id, 300).Ok, false);
	});

	void it("(k) 수정은 Id를 유지한 채 스펙을 갈아끼우고, 실패하면 아무것도 바꾸지 않는다", () =>
	{
		const harness = MakeHarness(kBaseMs, new Map<string, string>());
		const armed = RequireAlarm(harness.Engine.ArmSpec(MakeSpec("s1", { Kind: "After", OffsetSec: 600, Title: "원본" }), ""));
		const edited = RequireAlarm(harness.Engine.Reschedule(armed.Id, MakeSpec("s2", { Kind: "After", OffsetSec: 60, Title: "바꾼 제목" })));
		assert.equal(edited.Id, armed.Id);
		assert.equal(edited.SpecId, "s2");
		assert.equal(edited.Spec.Title, "바꾼 제목");
		assert.equal(edited.DueAtMs, kBaseMs + 60000);
		assert.equal(harness.Store.ListArmed().length, 1);

		const rejected = harness.Engine.Reschedule(armed.Id, MakeSpec("s3", { Kind: "At", AtTime: "이상한 시각" }));
		assert.equal(rejected.Ok, false);
		assert.equal(RequireFirst(harness.Store.ListArmed()).Spec.Title, "바꾼 제목");
		assert.equal(RequireFirst(harness.Store.ListArmed()).DueAtMs, kBaseMs + 60000);
		harness.Engine.Cancel(armed.Id);
		assert.equal(harness.Engine.Reschedule(armed.Id, MakeSpec("s4", {})).Ok, false);
	});

	void it("취소한 예약은 울리지 않는다", async () =>
	{
		const harness = MakeHarness(kBaseMs, new Map<string, string>());
		const armed = RequireAlarm(harness.Engine.ArmSpec(MakeSpec("s1", { Kind: "After", OffsetSec: 60 }), ""));
		assert.equal(harness.Engine.Cancel(armed.Id), true);
		assert.equal(harness.Engine.Cancel(armed.Id), false);
		harness.Clock.NowMs = kBaseMs + 60000;
		await harness.Engine.TickAsync();
		assert.equal(harness.Fired.length, 0);
		assert.equal(harness.Engine.PendingList().length, 0);
	});

	void it("보관 기간이 지난 이력만 지운다", () =>
	{
		const data = SeedState(new Map<string, string>(), [
			MakeArmed("old", { State: "Fired", DueAtMs: kBaseMs - 8 * 86400000, FiredAtMs: kBaseMs - 8 * 86400000 }),
			MakeArmed("recent", { State: "Canceled", DueAtMs: kBaseMs - 86400000, FiredAtMs: 0 }),
			MakeArmed("live", { State: "Armed", DueAtMs: kBaseMs + 600000 }),
		], 0);
		const harness = MakeHarness(kBaseMs, data);
		const report = harness.Engine.Restore();
		assert.equal(report.Pruned, 1);
		assert.deepStrictEqual(harness.Store.ListArmed().map((_a) => _a.Id).sort(), ["live", "recent"]);
	});

	void it("저장소가 깨져 있어도 살릴 수 있는 항목만 복원한다", () =>
	{
		const data = new Map<string, string>();
		data.set("State", JSON.stringify({ SchemaVersion: 1, LastSeenAtMs: 0, Armed: [null, { Id: "x" }, MakeArmed("ok1", {})] }));
		const harness = MakeHarness(kBaseMs, data);
		assert.deepStrictEqual(harness.Store.ListArmed().map((_a) => _a.Id), ["ok1"]);
	});

	void it("SpecFactory는 설정 기본값을 호출 시점에 읽어 채운다", () =>
	{
		const values = DefaultValues();
		values.DefaultDurationSec = 12;
		values.DefaultTopmost = false;
		const options = MakeOptions(values);
		const after = SpecFactory.After("s1", 90, "제목", "본문", options);
		assert.equal(after.Kind, "After");
		assert.equal(after.OffsetSec, 90);
		assert.equal(after.DurationSec, 12);
		assert.equal(after.Topmost, false);

		values.DefaultDurationSec = 3;
		const at = SpecFactory.At("s2", " 22:12 ", "제목", "", true, options);
		assert.equal(at.Kind, "At");
		assert.equal(at.AtTime, "22:12");
		assert.equal(at.RollToNextDay, true);
		assert.equal(at.DurationSec, 3);
	});

	void it("SpecFactory.FromRecord는 Kind를 생략해도 AtTime 유무로 고른다", () =>
	{
		const options = MakeOptions(DefaultValues());
		const relative = SpecFactory.FromRecord({ Title: "상대", Seconds: 30 }, "s1", options);
		assert.ok(relative !== null);
		assert.equal(relative.Kind, "After");
		assert.equal(relative.OffsetSec, 30);
		const absolute = SpecFactory.FromRecord({ Title: "절대", AtTime: "07:30" }, "s2", options);
		assert.ok(absolute !== null);
		assert.equal(absolute.Kind, "At");
		assert.equal(absolute.AtTime, "07:30");
		const custom = SpecFactory.FromRecord({ Title: "옵션", Seconds: 5, KindUi: "yesno", Topmost: false, WithToast: true }, "s3", options);
		assert.ok(custom !== null);
		assert.equal(custom.KindUi, "yesno");
		assert.equal(custom.Topmost, false);
		assert.equal(custom.WithToast, true);
		const broken = SpecFactory.FromRecord({ Title: "이상한 Kind", Seconds: 5, KindUi: "몰라" }, "s6", options);
		assert.ok(broken !== null);
		assert.equal(broken.KindUi, "ok");
		assert.equal(SpecFactory.FromRecord({ Seconds: 30 }, "s4", options), null);
		assert.equal(SpecFactory.FromRecord("깨진값", "s5", options), null);
	});

	void it("AlarmFormat은 남은 시간·경과·상태를 사람이 읽을 문구로 만든다", () =>
	{
		assert.equal(AlarmFormat.Remain(42000), "00:00:42");
		assert.equal(AlarmFormat.Remain(3661000), "01:01:01");
		assert.equal(AlarmFormat.Remain(-5000), "00:00:00");
		assert.equal(AlarmFormat.Elapsed(30000), "방금");
		assert.equal(AlarmFormat.Elapsed(720000), "12분 경과");
		assert.equal(AlarmFormat.Elapsed(7200000), "2시간 경과");
		assert.equal(AlarmFormat.Clock(kBaseMs, kBaseMs), "10:00");
		assert.equal(AlarmFormat.Clock(kBaseMs + 86400000, kBaseMs), "9/17 10:00");
		assert.equal(AlarmFormat.StateText(MakeArmed("a1", { State: "Armed" })), "예약");
		assert.equal(AlarmFormat.StateText(MakeArmed("a2", { State: "Missed" })), "지나감");
		assert.equal(AlarmFormat.StateText(MakeArmed("a3", { State: "Fired", Result: "ok" })), "완료·확인함");
		assert.equal(AlarmFormat.StateText(MakeArmed("a4", { State: "Fired", Result: "timeout" })), "완료");
		const summary = AlarmFormat.Summary(MakeArmed("a5", { DueAtMs: kBaseMs + 60000 }), kBaseMs);
		assert.equal(summary["RemainingMs"], 60000);
		assert.equal(summary["RemainText"], "00:01:00");
	});

	void it("AlarmFormat은 수정 폼에 넣을 날짜·시각 문자열도 만든다", () =>
	{
		// 수정 오버레이는 스펙이 아니라 실제 마감 시각에서 값을 되읽는다. 그래서 0을 채운 형식이 필요하다.
		assert.equal(AlarmFormat.DateInput(new Date(2026, 8, 7, 9, 5, 0, 0).getTime()), "2026-09-07");
		assert.equal(AlarmFormat.TimeInput(new Date(2026, 8, 7, 9, 5, 0, 0).getTime()), "09:05");
		assert.equal(AlarmFormat.TimeInput(new Date(2026, 8, 7, 22, 12, 0, 0).getTime()), "22:12");
		// 되읽은 문자열은 다시 그대로 파싱돼야 한다(왕복 검증).
		const at = new Date(2026, 11, 31, 23, 59, 0, 0).getTime();
		const parts = ParseAtTime(`${AlarmFormat.DateInput(at)} ${AlarmFormat.TimeInput(at)}`);
		assert.ok(parts !== null);
		assert.equal(parts.Year, 2026);
		assert.equal(parts.Month, 12);
		assert.equal(parts.Day, 31);
		assert.equal(parts.Hour, 23);
		assert.equal(parts.Minute, 59);
	});
});
