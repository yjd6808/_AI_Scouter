/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScriptRunner 단위 테스트. 가짜 저장소·가짜 시계·가짜 실행기라 실제 프로세스와 실시간 대기가 없다.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RunnerEngine } from "../../../../Plugins/ScriptRunner/RunnerEngine";
import { ScheduleCalc } from "../../../../Plugins/ScriptRunner/ScheduleCalc";
import { ScriptStore } from "../../../../Plugins/ScriptRunner/ScriptStore";
import { ScriptLauncher, PowerShellArgs } from "../../../../Plugins/ScriptRunner/ScriptLauncher";
import { ScriptFormat } from "../../../../Plugins/ScriptRunner/ScriptFormat";
import { SpecReader } from "../../../../Plugins/ScriptRunner/SpecReader";
import { RunLog } from "../../../../Plugins/ScriptRunner/RunLog";
import { OutputTailer } from "../../../../Plugins/ScriptRunner/OutputTailer";
import { GetLogTool } from "../../../../Plugins/ScriptRunner/Tools/GetLogTool";
import { ListTool } from "../../../../Plugins/ScriptRunner/Tools/ListTool";
import { PresetTool } from "../../../../Plugins/ScriptRunner/Tools/PresetTool";
import { RegisterTool } from "../../../../Plugins/ScriptRunner/Tools/RegisterTool";
import { RunTool } from "../../../../Plugins/ScriptRunner/Tools/RunTool";
import type { IEntrySpec, ILaunchRequest, ILaunchResult, IScriptLauncher, IScriptSchedule, IScriptStorage, ITextFs } from "../../../../Plugins/ScriptRunner/Types";

interface IKill
{
	Id: string;
	Token: string;
}

interface IHarness
{
	Data: Map<string, string>;
	Clock: { NowMs: number };
	Launcher: FakeLauncher;
	Store: ScriptStore;
	Engine: RunnerEngine;
	Missed: string[];
}

const kBaseMs = new Date(2026, 10, 12, 10, 0, 0, 0).getTime();
const kDayMs = 86400000;

class FakeLauncher implements IScriptLauncher
{
	public readonly Launches: ILaunchRequest[] = [];
	public readonly Kills: IKill[] = [];
	public readonly Resets: string[] = [];
	public Log = "";
	private readonly pending_ = new Map<string, (_result: ILaunchResult) => void>();
	private readonly queued_ = new Map<string, ILaunchResult>();

	public LaunchAsync(_req: ILaunchRequest): Promise<ILaunchResult>
	{
		this.Launches.push(_req);
		const queued = this.queued_.get(_req.EntryId);
		if (queued !== undefined)
		{
			this.queued_.delete(_req.EntryId);
			return Promise.resolve(queued);
		}
		if (_req.Signal.aborted)
			return Promise.resolve({ Code: -1, Stdout: "", Stderr: "" });
		return new Promise((_resolve) =>
		{
			this.pending_.set(_req.EntryId, _resolve);
			_req.Signal.addEventListener("abort", () => { _resolve({ Code: -1, Stdout: "", Stderr: "" }); });
		});
	}

	// 실행기가 아직 불리기 전이면(출력 파일 비우기를 기다리는 중) 결과를 맡겨 두었다가 불릴 때 바로 돌려준다.
	public Finish(_id: string, _code: number): void
	{
		const result = { Code: _code, Stdout: "", Stderr: _code === 0 ? "" : "boom" };
		const pending = this.pending_.get(_id);
		if (pending === undefined)
		{
			this.queued_.set(_id, result);
			return;
		}
		pending(result);
		this.pending_.delete(_id);
	}

	public ResetLogAsync(_entryId: string): Promise<void>
	{
		this.Resets.push(_entryId);
		return Promise.resolve();
	}

	public KillAsync(_entryId: string, _runToken: string): Promise<boolean>
	{
		this.Kills.push({ Id: _entryId, Token: _runToken });
		return Promise.resolve(true);
	}

	public ReadLogAsync(_entryId: string): Promise<string>
	{
		return Promise.resolve(this.Log);
	}

	public QueryBootMarkAsync(): Promise<number | null>
	{
		return Promise.resolve(null);
	}
}

function MemoryStorage(_data: Map<string, string>): IScriptStorage
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

function MemoryFs(_files: Map<string, string>): ITextFs
{
	return {
		ReadText: (_path: string): Promise<string> =>
		{
			const text = _files.get(_path);
			return text === undefined ? Promise.reject(new Error("ENOENT")) : Promise.resolve(text);
		},
		WriteText: (_path: string, _text: string): Promise<void> =>
		{
			_files.set(_path, _text);
			return Promise.resolve();
		},
	};
}

function MakeHarness(_data?: Map<string, string>): IHarness
{
	const data = _data ?? new Map<string, string>();
	const clock = { NowMs: kBaseMs };
	const launcher = new FakeLauncher();
	const store = new ScriptStore(MemoryStorage(data));
	const missed: string[] = [];
	const engine = new RunnerEngine({
		Store: store,
		Launcher: launcher,
		Now: { Now: () => clock.NowMs },
		Logger: { Info: () => undefined, Warn: () => undefined },
		Missed: (_list) => { missed.push(..._list.map((_e) => _e.Id)); },
	});
	return { Data: data, Clock: clock, Launcher: launcher, Store: store, Engine: engine, Missed: missed };
}

function NoSchedule(): IScriptSchedule
{
	return { Enabled: false, Kind: "After", OffsetSec: 0, AtTime: "", Repeat: false };
}

function Spec(_patch: Partial<IEntrySpec> = {}): IEntrySpec
{
	return { Title: "", Path: "C:\\Tools\\a.ps1", Args: [], Schedule: NoSchedule(), KeepAfterBoot: false, ..._patch };
}

function Flush(): Promise<void>
{
	return new Promise((_resolve) => { setImmediate(_resolve); });
}

const kCall = { SessionId: "t", Progress: (): void => undefined, Signal: new AbortController().signal, Log: (): void => undefined };

void describe("ScriptRunner", () =>
{
	void it("ScheduleCalc: 시간 뒤 첫 실행과 반복 간격(지난 회차는 건너뜀)", () =>
	{
		const after: IScriptSchedule = { Enabled: true, Kind: "After", OffsetSec: 90, AtTime: "", Repeat: true };
		const first = ScheduleCalc.FirstDue(after, kBaseMs);
		assert.deepEqual(first, { Ok: true, DueAtMs: kBaseMs + 90000 });
		assert.equal(ScheduleCalc.NextAfterFire(after, kBaseMs, kBaseMs + 1000), kBaseMs + 90000);
		// 5분 늦게 처리하면 지난 회차(90·180·270초)를 건너뛰고 360초 회차로 간다.
		assert.equal(ScheduleCalc.NextAfterFire(after, kBaseMs, kBaseMs + 300000), kBaseMs + 360000);
		assert.equal(ScheduleCalc.NextAfterFire({ ...after, Repeat: false }, kBaseMs, kBaseMs), 0);
		assert.equal(ScheduleCalc.FirstDue({ ...after, OffsetSec: 0 }, kBaseMs).Ok, false);
		assert.deepEqual(ScheduleCalc.FirstDue(NoSchedule(), kBaseMs), { Ok: true, DueAtMs: 0 });
	});

	void it("ScheduleCalc: 특정 시각은 지났으면 내일, 날짜 지정은 반복일 때만 넘긴다", () =>
	{
		const at: IScriptSchedule = { Enabled: true, Kind: "At", OffsetSec: 0, AtTime: "12:30", Repeat: false };
		assert.deepEqual(ScheduleCalc.FirstDue(at, kBaseMs), { Ok: true, DueAtMs: new Date(2026, 10, 12, 12, 30).getTime() });
		assert.deepEqual(ScheduleCalc.FirstDue({ ...at, AtTime: "09:00" }, kBaseMs), { Ok: true, DueAtMs: new Date(2026, 10, 13, 9, 0).getTime() });
		const pastDated = { ...at, AtTime: "2026-11-10 09:00" };
		assert.equal(ScheduleCalc.FirstDue(pastDated, kBaseMs).Ok, false);
		assert.deepEqual(ScheduleCalc.FirstDue({ ...pastDated, Repeat: true }, kBaseMs), { Ok: true, DueAtMs: new Date(2026, 10, 13, 9, 0).getTime() });
		assert.equal(ScheduleCalc.FirstDue({ ...at, AtTime: "2026-02-30 09:00" }, kBaseMs).Ok, false);
		assert.equal(ScheduleCalc.FirstDue({ ...at, AtTime: "25:00" }, kBaseMs).Ok, false);
		const due = new Date(2026, 10, 12, 12, 30).getTime();
		assert.equal(ScheduleCalc.NextAfterFire({ ...at, Repeat: true }, due, due + 5000), due + kDayMs);
		assert.equal(ScheduleCalc.Describe({ ...at, Repeat: true }), "매일 12:30");
	});

	void it("ScriptStore: 기본 제목은 스크립트-N, 깨진 저장 항목은 버린다", () =>
	{
		const data = new Map<string, string>();
		data.set("State", JSON.stringify({ Seq: 4, Entries: [{ Id: "s4", Title: "스크립트-3", Path: "C:\\x.bat" }, { Title: "경로 없음" }, 3] }));
		const store = new ScriptStore(MemoryStorage(data));
		assert.equal(store.List().length, 1);
		assert.equal(store.DefaultTitle(), "스크립트-4");
		assert.equal(store.NewId(), "s5");
		const empty = new ScriptStore(MemoryStorage(new Map()));
		assert.equal(empty.DefaultTitle(), "스크립트-1");
	});

	void it("등록: 경로·인자 이름 검사, 제목 기본값, Revision 증가", () =>
	{
		const h = MakeHarness();
		assert.equal(h.Engine.Register(Spec({ Path: "  " })).Ok, false);
		assert.equal(h.Engine.Register(Spec({ Args: [{ Name: "", Required: true, Value: "" }] })).Ok, false);
		assert.equal(h.Engine.Register(Spec({ Args: [{ Name: "A", Required: true, Value: "" }, { Name: "A", Required: false, Value: "" }] })).Ok, false);
		const before = h.Engine.Revision;
		const outcome = h.Engine.Register(Spec({ Path: "\"C:\\경로 공백\\b.ps1\"" }));
		assert.ok(outcome.Ok);
		assert.equal(outcome.Entry.Title, "스크립트-1");
		assert.equal(outcome.Entry.Path, "C:\\경로 공백\\b.ps1");
		assert.equal(h.Engine.Revision, before + 1);
		h.Engine.SetArgValue(outcome.Entry.Id, 0, "x");
		assert.equal(h.Engine.Revision, before + 1);
	});

	void it("실행: 필수 인자가 비면 거부, 가운데 빈 인자는 자리를 지키고 종료 코드로 결과가 갈린다", async () =>
	{
		const h = MakeHarness();
		const reg = h.Engine.Register(Spec({ Args: [{ Name: "Mode", Required: true, Value: "" }, { Name: "Cl", Required: false, Value: "" }, { Name: "Branch", Required: false, Value: "Root" }] }));
		assert.ok(reg.Ok);
		const id = reg.Entry.Id;
		const refused = h.Engine.Run(id, "Manual");
		assert.equal(refused.Ok, false);
		assert.match(refused.Error, /Mode/);
		const run = h.Engine.Run(id, "Manual", { Mode: "1" });
		assert.ok(run.Ok);
		await Flush();
		assert.deepEqual(h.Launcher.Resets, [id]);
		assert.deepEqual(h.Launcher.Launches[0]?.Args, ["1", "", "Root"]);
		assert.equal(h.Engine.StateOf(reg.Entry), "Running");
		assert.equal(h.Engine.Run(id, "Manual").Ok, false);
		h.Clock.NowMs += 3000;
		h.Launcher.Finish(id, 0);
		const record = await run.Done;
		assert.equal(record.Result, "Success");
		assert.equal(record.EndedAtMs - record.StartedAtMs, 3000);
		const again = h.Engine.Run(id, "Mcp", ["0", "", ""]);
		assert.ok(again.Ok);
		await Flush();
		assert.deepEqual(h.Launcher.Launches[1]?.Args, ["0"]);
		h.Launcher.Finish(id, 3);
		const failed = await again.Done;
		assert.equal(failed.Result, "Failed");
		assert.equal(failed.ExitCode, 3);
		assert.equal(reg.Entry.Args[0]?.Value, "0");
		assert.equal(ScriptFormat.ResultText(reg.Entry.LastRun), "실패 (3)");
		assert.equal(h.Engine.Run(id, "Mcp", { Unknown: "1" }).Ok, false);
	});

	void it("중지: 토큰으로 프로세스 트리를 끝내고 결과는 Stopped", async () =>
	{
		const h = MakeHarness();
		const reg = h.Engine.Register(Spec());
		assert.ok(reg.Ok);
		const run = h.Engine.Run(reg.Entry.Id, "Manual");
		assert.ok(run.Ok);
		await Flush();
		assert.equal(await h.Engine.StopAsync(reg.Entry.Id), true);
		assert.equal(h.Launcher.Kills.length, 1);
		assert.equal(h.Launcher.Kills[0]?.Token, h.Launcher.Launches[0]?.RunToken);
		assert.equal(reg.Entry.LastRun?.Result, "Stopped");
		assert.equal(h.Engine.IsRunning(reg.Entry.Id), false);
		assert.equal(await h.Engine.StopAsync(reg.Entry.Id), false);
	});

	void it("tick: 예약 회차를 실행하고 반복이면 다음 회차, 실행 중이면 그 회차는 건너뛴다", async () =>
	{
		const h = MakeHarness();
		const reg = h.Engine.Register(Spec({ Schedule: { Enabled: true, Kind: "After", OffsetSec: 10, AtTime: "", Repeat: true } }));
		assert.ok(reg.Ok);
		const entry = reg.Entry;
		assert.equal(entry.NextDueAtMs, kBaseMs + 10000);
		assert.equal(h.Engine.Tick(), 0);
		h.Clock.NowMs = kBaseMs + 10000;
		assert.equal(h.Engine.Tick(), 1);
		await Flush();
		assert.equal(entry.LastRun?.Trigger, "Schedule");
		assert.equal(entry.NextDueAtMs, kBaseMs + 20000);
		h.Clock.NowMs = kBaseMs + 20000;
		assert.equal(h.Engine.Tick(), 0);
		assert.equal(h.Launcher.Launches.length, 1);
		assert.equal(entry.NextDueAtMs, kBaseMs + 30000);
		h.Launcher.Finish(entry.Id, 0);
		await Flush();
		const once = h.Engine.Register(Spec({ Schedule: { Enabled: true, Kind: "After", OffsetSec: 5, AtTime: "", Repeat: false }, Args: [{ Name: "Need", Required: true, Value: "" }] }));
		assert.ok(once.Ok);
		h.Clock.NowMs += 5000;
		h.Engine.Tick();
		assert.equal(once.Entry.NextDueAtMs, 0);
		assert.equal(once.Entry.LastRun?.Result, "Error");
		assert.match(once.Entry.LastRun.Error, /Need/);
	});

	void it("복원: 1회 예약은 지나감, 반복은 다음 회차, 실행 중 기록은 오류로 닫는다", () =>
	{
		const first = MakeHarness();
		const once = first.Engine.Register(Spec({ Title: "once", Schedule: { Enabled: true, Kind: "After", OffsetSec: 60, AtTime: "", Repeat: false } }));
		const daily = first.Engine.Register(Spec({ Title: "daily", Schedule: { Enabled: true, Kind: "At", OffsetSec: 0, AtTime: "11:00", Repeat: true } }));
		const busy = first.Engine.Register(Spec({ Title: "busy" }));
		assert.ok(once.Ok && daily.Ok && busy.Ok);
		first.Engine.Run(busy.Entry.Id, "Manual");
		const second = MakeHarness(first.Data);
		second.Clock.NowMs = kBaseMs + 2 * 3600000;
		const report = second.Engine.Restore();
		assert.equal(report.Missed.length, 1);
		assert.equal(report.Advanced, 1);
		assert.equal(report.Interrupted, 1);
		assert.deepEqual(second.Missed, [once.Entry.Id]);
		const restored = second.Store.List();
		assert.equal(restored[0]?.NextDueAtMs, 0);
		assert.ok(restored[0].MissedAtMs > 0);
		assert.equal(restored[1]?.NextDueAtMs, new Date(2026, 10, 13, 11, 0).getTime());
		assert.equal(restored[2]?.LastRun?.Result, "Error");
		assert.equal(ScriptFormat.RemainText(restored[0], "Idle", second.Clock.NowMs), "지나감");
	});

	void it("부팅 판정: 표식이 바뀌면 KeepAfterBoot가 꺼진 예약만 풀고, Scouter만 다시 켠 경우는 유지한다", () =>
	{
		const schedule: IScriptSchedule = { Enabled: true, Kind: "At", OffsetSec: 0, AtTime: "23:00", Repeat: true };
		const bootA = kBaseMs - 3600000;
		const first = MakeHarness();
		const drop = first.Engine.Register(Spec({ Title: "drop", Schedule: schedule }));
		const keep = first.Engine.Register(Spec({ Title: "keep", Schedule: schedule, KeepAfterBoot: true }));
		assert.ok(drop.Ok && keep.Ok);
		assert.equal(first.Engine.Restore(bootA).Rebooted, false);
		assert.equal(first.Store.BootMarkMs, bootA);
		const restart = MakeHarness(first.Data);
		const same = restart.Engine.Restore(bootA + 1200);
		assert.equal(same.Rebooted, false);
		assert.equal(restart.Store.List().filter((_e) => _e.NextDueAtMs > 0).length, 2);
		const unknown = MakeHarness(first.Data).Engine.Restore(null);
		assert.equal(unknown.Rebooted, false);
		const reboot = MakeHarness(first.Data);
		const report = reboot.Engine.Restore(kBaseMs - 60000);
		assert.equal(report.Rebooted, true);
		assert.deepEqual(report.ClearedByBoot.map((_e) => _e.Title), ["drop"]);
		const [dropped, kept] = reboot.Store.List();
		assert.equal(dropped?.NextDueAtMs, 0);
		assert.equal(dropped.MissedAtMs, 0);
		assert.equal(dropped.Schedule.Enabled, true);
		assert.equal(kept?.NextDueAtMs, new Date(2026, 10, 12, 23, 0).getTime());
		assert.equal(reboot.Store.BootMarkMs, kBaseMs - 60000);
	});

	void it("KeepAfterBoot: 옛 저장 항목은 켜짐, 값만 바꾸면 남은 시간은 그대로", () =>
	{
		const data = new Map<string, string>();
		data.set("State", JSON.stringify({ Seq: 1, Entries: [{ Id: "s1", Path: "C:\\x.bat", NextDueAtMs: kBaseMs + 1000, Schedule: { Enabled: true, Kind: "After", OffsetSec: 1 } }] }));
		const h = MakeHarness(data);
		const old = h.Store.Find("s1");
		assert.equal(old?.KeepAfterBoot, true);
		h.Clock.NowMs += 500;
		const updated = h.Engine.Update("s1", { KeepAfterBoot: false });
		assert.ok(updated.Ok);
		assert.equal(updated.Entry.KeepAfterBoot, false);
		assert.equal(updated.Entry.NextDueAtMs, kBaseMs + 1000);
		const spec = SpecReader.ReadSpec({ Path: "C:\\a.ps1", AfterSeconds: 10 });
		assert.ok(spec.Ok);
		assert.equal(spec.Spec.KeepAfterBoot, false);
		const on = SpecReader.ReadSpec({ Path: "C:\\a.ps1", AfterSeconds: 10, KeepAfterBoot: true });
		assert.ok(on.Ok);
		assert.equal(on.Spec.KeepAfterBoot, true);
		assert.equal(SpecReader.ReadSpec({ Path: "C:\\a.ps1", KeepAfterBoot: "yes" }).Ok, false);
		const patch = SpecReader.ReadPatch({ KeepAfterBoot: true }, updated.Entry);
		assert.ok(patch.Ok);
		assert.deepEqual(patch.Patch, { KeepAfterBoot: true });
	});

	void it("수정: 예약을 주면 다시 걸고, 안 주면 남은 시간을 그대로 둔다", async () =>
	{
		const h = MakeHarness();
		const reg = h.Engine.Register(Spec({ Schedule: { Enabled: true, Kind: "After", OffsetSec: 60, AtTime: "", Repeat: false } }));
		assert.ok(reg.Ok);
		h.Clock.NowMs += 30000;
		h.Engine.Update(reg.Entry.Id, { Title: "새 제목" });
		assert.equal(reg.Entry.NextDueAtMs, kBaseMs + 60000);
		h.Engine.Update(reg.Entry.Id, { Schedule: { ...reg.Entry.Schedule } });
		assert.equal(reg.Entry.NextDueAtMs, kBaseMs + 90000);
		h.Engine.Update(reg.Entry.Id, { Schedule: NoSchedule() });
		assert.equal(reg.Entry.NextDueAtMs, 0);
		assert.equal(await h.Engine.RemoveAsync(reg.Entry.Id), true);
		assert.equal(h.Store.List().length, 0);
	});

	void it("출력: 끝에서부터 자르고 전체 길이를 알려 준다", async () =>
	{
		const h = MakeHarness();
		h.Launcher.Log = "0123456789";
		const out = await h.Engine.ReadOutputAsync("s1", 4);
		assert.deepEqual(out, { Text: "6789", TotalChars: 10, Truncated: true });
	});

	void it("SpecReader: 평평한 예약 필드와 인자 값 형식을 검사한다", () =>
	{
		const after = SpecReader.ReadSpec({ Path: "C:\\a.ps1", AfterSeconds: 30, Repeat: true, Args: ["Mode", { Name: "Cl", Required: false }] });
		assert.ok(after.Ok);
		assert.deepEqual(after.Spec.Schedule, { Enabled: true, Kind: "After", OffsetSec: 30, AtTime: "", Repeat: true });
		assert.deepEqual(after.Spec.Args.map((_a) => _a.Required), [true, false]);
		const at = SpecReader.ReadSpec({ Path: "C:\\a.ps1", AtDate: "2026-11-20", AtTime: "07:05" });
		assert.ok(at.Ok && at.Spec.Schedule.Kind === "At" && at.Spec.Schedule.AtTime === "2026-11-20 07:05");
		assert.equal(SpecReader.ReadSpec({ Path: "C:\\a.ps1", Repeat: true }).Ok, false);
		assert.equal(SpecReader.ReadSpec({ Path: "C:\\a.ps1", AtDate: "2026-13-01", AtTime: "07:05" }).Ok, false);
		assert.equal(SpecReader.ReadSpec({ Path: "C:\\a.ps1", Schedule: "Weekly" }).Ok, false);
		assert.equal(SpecReader.ReadSpec({}).Ok, false);
		assert.deepEqual(SpecReader.ReadValues({ Mode: 1 }), { Ok: true, Values: { Mode: "1" } });
		assert.deepEqual(SpecReader.ReadValues(["1", 2]), { Ok: true, Values: ["1", "2"] });
		assert.equal(SpecReader.ReadValues("x").Ok, false);
	});

	void it("ScriptLauncher: 경로·인자는 환경 변수로, 명령줄은 cmd.exe 상한(8191자) 안", () =>
	{
		const launcher = new ScriptLauncher(
			{ Exec: () => Promise.resolve({ Code: 0, Stdout: "", Stderr: "" }) },
			MemoryFs(new Map()),
			"C:/Users/u/.scouter/plugins/ScriptRunner",
			{ PythonExe: () => "", NodeExe: () => "node", MaxLogKB: () => 128 },
		);
		const env = launcher.BuildEnv({ EntryId: "s3", RunToken: "tok", Path: "D:\\스크립트\\a b.ps1", Args: ["1", "루트"], Signal: new AbortController().signal });
		assert.equal(env["SR_PATH"], "D:\\스크립트\\a b.ps1");
		assert.equal(env["SR_ARGC"], "2");
		assert.equal(env["SR_ARG1"], "루트");
		assert.equal(env["SR_PY"], "python");
		assert.equal(env["SR_MAXLOG"], String(128 * 1024));
		assert.equal(env["SR_LOG"], "C:/Users/u/.scouter/plugins/ScriptRunner/logs/s3.log");
		const line = ["powershell", ...PowerShellArgs(ScriptLauncher.WrapperScript())].join(" ");
		assert.ok(line.length < 8191, `명령줄 ${line.length}자`);
		const encoded = PowerShellArgs("한글 OK")[5] ?? "";
		const bytes = Buffer.from(encoded, "base64");
		assert.equal(bytes.toString("utf16le"), "한글 OK");
	});

	void it("Tool: Register(RunNow)·List(RunningOnly)·Run 인자 오류", async () =>
	{
		const h = MakeHarness();
		const registered = await new RegisterTool(h.Engine).Run({ Path: "C:\\a.ps1", Title: "빌드", RunNow: true }, kCall) as { Item: { Id: string; State: string }; RunId: string };
		assert.equal(registered.Item.State, "Running");
		assert.equal(registered.RunId, `${registered.Item.Id}.1`);
		await new RegisterTool(h.Engine).Run({ Path: "C:\\b.ps1" }, kCall);
		const list = await new ListTool(h.Engine).Run({ RunningOnly: true }, kCall) as { Counts: { Total: number; Running: number }; Items: Array<{ Title: string; ScriptName: string }> };
		assert.equal(list.Counts.Total, 2);
		assert.equal(list.Counts.Running, 1);
		assert.deepEqual(list.Items.map((_i) => _i.ScriptName), ["a.ps1"]);
		await assert.rejects(new RunTool(h.Engine).Run({ Id: registered.Item.Id }, kCall), /이미 실행 중/);
		await assert.rejects(new ListTool(h.Engine).Run({ Id: "s99" }, kCall), /없는 스크립트/);
		h.Launcher.Finish(registered.Item.Id, 0);
		await Flush();
	});

	void it("프리셋: 저장·덮어쓰기·불러오기·삭제, 프리셋으로 실행, 저장 후 다시 읽기", async () =>
	{
		const h = MakeHarness();
		const reg = h.Engine.Register(Spec({ Args: [{ Name: "Mode", Required: true, Value: "1" }, { Name: "CL", Required: false, Value: "" }, { Name: "Branch", Required: false, Value: "main" }] }));
		assert.ok(reg.Ok);
		const id = reg.Entry.Id;
		assert.equal(h.Engine.SavePreset(id, "없음").Ok, false);
		assert.equal(h.Engine.SavePreset(id, "  ").Ok, false);
		const saved = h.Engine.SavePreset(id, "release");
		assert.ok(saved.Ok);
		assert.deepEqual(saved.Entry.Presets, [{ Name: "release", Values: { Mode: "1", CL: "", Branch: "main" } }]);
		assert.equal(saved.Entry.SelectedPreset, "release");
		assert.ok(h.Engine.SavePreset(id, "release-2", { CL: "1234567", Branch: "backup" }).Ok);
		assert.equal(reg.Entry.Args[2]?.Value, "main");
		assert.equal(reg.Entry.SelectedPreset, "release");
		h.Engine.SetArgValue(id, 0, "0");
		const loaded = h.Engine.ApplyPreset(id, "release-2");
		assert.ok(loaded.Ok);
		assert.deepEqual(reg.Entry.Args.map((_a) => _a.Value), ["1", "1234567", "backup"]);
		assert.ok(h.Engine.ApplyPreset(id, "").Ok);
		assert.equal(reg.Entry.SelectedPreset, "");
		assert.equal(reg.Entry.Args[1]?.Value, "1234567");
		assert.equal(h.Engine.ApplyPreset(id, "없는").Ok, false);
		const run = h.Engine.Run(id, "Mcp", undefined, "release");
		assert.ok(run.Ok);
		await Flush();
		assert.deepEqual(h.Launcher.Launches[0]?.Args, ["1", "", "main"]);
		assert.equal(reg.Entry.SelectedPreset, "release");
		h.Launcher.Finish(id, 0);
		await run.Done;
		assert.equal(h.Engine.Run(id, "Mcp", undefined, "없는").Ok, false);
		assert.ok(h.Engine.SavePreset(id, "release", ["9"]).Ok);
		assert.equal(reg.Entry.Presets.length, 2);
		assert.equal(reg.Entry.Presets[0]?.Values["Mode"], "9");
		const reread = MakeHarness(h.Data).Store.Find(id);
		assert.deepEqual(reread?.Presets.map((_p) => _p.Name), ["release", "release-2"]);
		assert.equal(reread.SelectedPreset, "release");
		assert.ok(h.Engine.DeletePreset(id, "release").Ok);
		assert.equal(reg.Entry.SelectedPreset, "");
		assert.equal(h.Engine.DeletePreset(id, "release").Ok, false);
		const bare = h.Engine.Register(Spec());
		assert.ok(bare.Ok);
		assert.equal(h.Engine.SavePreset(bare.Entry.Id, "P").Ok, false);
		const tool = new PresetTool(h.Engine);
		const viaTool = await tool.Run({ Id: id, Action: "Save", Name: "P1", ArgValues: { Mode: "2" } }, kCall) as { Item: { Presets: Array<{ Name: string; Values: Record<string, string> }> } };
		assert.equal(viaTool.Item.Presets.find((_p) => _p.Name === "P1")?.Values["Mode"], "2");
		await assert.rejects(tool.Run({ Id: id, Action: "Rename", Name: "P1" }, kCall), /Action/);
	});

	void it("실행 로그: 시작·출력(덜 끝난 줄은 다음에)·종료 줄과 예약 알림을 남기고, 파일로 저장·복원한다", async () =>
	{
		const h = MakeHarness();
		const files = new Map<string, string>();
		const log = new RunLog(MemoryFs(files), "L/history.log", { MaxLines: () => 5000 });
		const tailer = new OutputTailer(h.Engine, h.Launcher, log, { Now: () => h.Clock.NowMs });
		const detach = tailer.Attach();
		const reg = h.Engine.Register(Spec({ Title: "빌드", Args: [{ Name: "A", Required: false, Value: "x y" }] }));
		assert.ok(reg.Ok);
		const id = reg.Entry.Id;
		const run = h.Engine.Run(id, "Manual");
		assert.ok(run.Ok);
		await Flush();
		h.Launcher.Log = "줄1\r\n줄2 일부";
		await tailer.PollAsync();
		assert.deepEqual(log.List(id).map((_l) => _l.Text), [`▶ 실행 시작 ${id}.1 (수동) · 인자: "x y"`, "줄1"]);
		h.Launcher.Log = "줄1\r\n줄2 일부 끝\r\n마지막";
		h.Clock.NowMs += 2000;
		h.Launcher.Finish(id, 0);
		await run.Done;
		await Flush();
		await Flush();
		assert.deepEqual(log.List(id).map((_l) => _l.Text).slice(2), ["줄2 일부 끝", "마지막", "■ 완료 (0) · 00:00:02"]);
		const due = h.Engine.Register(Spec({ Title: "예약", Schedule: { Enabled: true, Kind: "After", OffsetSec: 1, AtTime: "", Repeat: false }, Args: [{ Name: "Need", Required: true, Value: "" }] }));
		assert.ok(due.Ok);
		h.Clock.NowMs += 1000;
		h.Engine.Tick();
		assert.match(log.List(due.Entry.Id).at(-1)?.Text ?? "", /^⚠ 예약 실행 실패: 필수 인자가 비어 있습니다: Need$/);
		await log.FlushAsync();
		const reloaded = new RunLog(MemoryFs(files), "L/history.log", { MaxLines: () => 5000 });
		let reset = false;
		reloaded.OnChanged((_added, _reset) => { reset = _reset; });
		await reloaded.LoadAsync();
		assert.equal(reset, true);
		assert.equal(reloaded.Count, log.Count);
		assert.match(RunLog.Format(reloaded.List(id)[1] ?? { Ts: 0, EntryId: "", Title: "", Text: "" }), new RegExp(`^\\d\\d-\\d\\d \\d\\d:\\d\\d:\\d\\d \\[${id} 빌드\\] 줄1$`));
		const getLog = await new GetLogTool(reloaded, h.Engine).Run({ Id: id, Lines: 2 }, kCall) as { Lines: string[]; TotalLines: number };
		assert.equal(getLog.TotalLines, 5);
		assert.equal(getLog.Lines.length, 2);
		assert.match(getLog.Lines[1] ?? "", /■ 완료 \(0\)/);
		const small = new RunLog(MemoryFs(new Map()), "x", { MaxLines: () => 10 });
		small.Add(Array.from({ length: 150 }, (_v, _idx) => ({ Ts: kBaseMs, EntryId: "s1", Title: "t\tab", Text: `n${_idx}` })));
		assert.equal(small.Count, 100);
		assert.equal(small.List("s1", 1)[0]?.Text, "n149");
		assert.equal(small.List()[0]?.Title, "t ab");
		small.Clear();
		assert.equal(small.Count, 0);
		await small.FlushAsync();
		detach();
	});
});
