/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P9 운영 단위 테스트. 인자·로그·자동시작·충돌·IPC.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LaunchArgs } from "../../../Scouter.App/Main/LaunchArgs";
import { MainLog } from "../../../Scouter.App/Main/MainLog";
import { AutoStart } from "../../../Scouter.App/Main/AutoStart";
import { CrashReporter } from "../../../Scouter.App/Main/CrashReporter";
import { IpcHost } from "../../../Scouter.App/Main/IpcHost";
import type { IMainWindowOps, IAppOps } from "../../../Scouter.App/Main/IpcHost";
import { FileLogSink } from "../../../Scouter.App/Renderer/Services/FileLogSink";
import type { ILogEntry } from "@scouter/gui";

function TempDir(_tag: string): string
{
	const dir = path.join(os.tmpdir(), `scouter-p9-${process.pid}-${_tag}`);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

function FakeIpc(): { Handlers: Map<string, (..._args: unknown[]) => unknown>; Ipc: { Handle(_c: string, _fn: (..._args: unknown[]) => unknown): void } }
{
	const handlers = new Map<string, (..._args: unknown[]) => unknown>();
	return {
		Handlers: handlers,
		Ipc: { Handle: (_c, _fn) => { handlers.set(_c, _fn); } },
	};
}

function FakeWin(): { Ops: IMainWindowOps; Calls: string[]; Sent: Array<{ Channel: string; Args: unknown[] }>; Maximized: boolean; FireMaximize(): void }
{
	const calls: string[] = [];
	const sent: Array<{ Channel: string; Args: unknown[] }> = [];
	let maximized = false;
	let onMax: (() => void) | null = null;
	const ops: IMainWindowOps = {
		Minimize: () => { calls.push("min"); },
		Maximize: () => { calls.push("max"); maximized = true; },
		Unmaximize: () => { calls.push("unmax"); maximized = false; },
		IsMaximized: () => maximized,
		Close: () => { calls.push("close"); },
		Hide: () => { calls.push("hide"); },
		Show: () => { calls.push("show"); },
		Focus: () => { calls.push("focus"); },
		ToggleDevTools: () => { calls.push("dev"); },
		CapturePage: () => Promise.resolve({ Png: "png" }),
		FlashFrame: () => { calls.push("flash"); },
		Send: (_c, ..._a) => { sent.push({ Channel: _c, Args: _a }); },
		OnClose: () => undefined,
		OnMaximize: (_fn) => { onMax = _fn; },
		OnUnmaximize: () => undefined,
	};
	return { Ops: ops, Calls: calls, Sent: sent, Maximized: maximized, FireMaximize: () => { onMax?.(); } };
}

void describe("Operations", () =>
{
	void it("LaunchArgs 조합·port 0", () =>
	{
		const args = LaunchArgs.Parse(["exe", "main", "--test", "--hidden", "--no-auth", "--safe", "--layout-dir", "L", "--plugin-dir", "P", "--port", "9515"]);
		assert.equal(args.Test, true);
		assert.equal(args.Hidden, true);
		assert.equal(args.NoAuth, true);
		assert.equal(args.Safe, true);
		assert.equal(args.LayoutDir, "L");
		assert.equal(args.PluginDir, "P");
		assert.equal(args.Port, 9515);
		assert.equal(LaunchArgs.Parse(["exe", "--port", "0"]).Port, 0);
		assert.equal(LaunchArgs.Parse(["exe", "--port", "abc"]).Port, null);
		assert.equal(LaunchArgs.Parse(["exe"]).Port, null);
	});

	void it("MainLog 일별·보관·상한", () =>
	{
		const dir = TempDir("mainlog");
		let now = Date.parse("2026-09-01T00:00:00Z");
		const log = new MainLog(dir, 7, 10, { Now: () => now });
		log.Info("T", "one");
		assert.equal(fs.readFileSync(path.join(dir, "main-20260901.log"), "utf-8").includes("one"), true);
		now = Date.parse("2026-09-09T00:00:00Z");
		log.Info("T", "two");
		assert.equal(fs.existsSync(path.join(dir, "main-20260901.log")), false);
		assert.equal(fs.readFileSync(path.join(dir, "main-20260909.log"), "utf-8").includes("two"), true);
		log.Info("T", "x".repeat(100));
		assert.equal(fs.readFileSync(path.join(dir, "main-20260909.log"), "utf-8").includes("xxxx"), false);
	});

	void it("AutoStart 조회·설정", () =>
	{
		let open = false;
		let gotArgs: string[] = [];
		const app = {
			SetLoginItemSettings: (_o: { openAtLogin: boolean; args: string[] }) => { open = _o.openAtLogin; gotArgs = _o.args; },
			GetLoginItemSettings: () => ({ openAtLogin: open }),
		};
		AutoStart.Set(app, true);
		assert.deepEqual(gotArgs, ["--hidden"]);
		assert.equal(AutoStart.Get(app), true);
		AutoStart.Set(app, false);
		assert.equal(AutoStart.Get(app), false);
	});

	void it("CrashReporter 포맷·기록", () =>
	{
		const dir = TempDir("crash");
		const payload = CrashReporter.Format("unittest", new Error("boom"), ["a", "b"]);
		assert.equal(payload.Kind, "unittest");
		assert.equal(payload.Message, "boom");
		assert.ok(payload.Stack.length > 0);
		const full = CrashReporter.WriteCrash(dir, payload);
		assert.equal(fs.existsSync(full), true);
		assert.ok((JSON.parse(fs.readFileSync(full, "utf-8")) as { Message?: string }).Message === "boom");
	});

	void it("IpcHost 채널 페이로드", async () =>
	{
		const fake = FakeIpc();
		const win = FakeWin();
		const appCalls: string[] = [];
		const app: IAppOps = {
			Paths: () => ({ UserData: "u", Home: "h", Exe: "e", AppPath: "a", Resources: "r", Logs: "l", Temp: "t", Version: "0.4.0", IsPackaged: false, Args: [] }),
			SetAutoStart: (_e) => { appCalls.push(`auto:${_e}`); },
			SetGlobalHotkey: (_a) => { appCalls.push(`hot:${_a}`); return _a.length > 0; },
			CheckForUpdates: () => { appCalls.push("check"); return Promise.resolve(); },
			InstallUpdate: () => { appCalls.push("install"); },
			Relaunch: () => { appCalls.push("relaunch"); },
			ShowItem: (_p) => { appCalls.push(`show:${_p}`); },
			OpenDialog: () => Promise.resolve(null),
			SaveDialog: () => Promise.resolve(null),
			SetTrayTooltip: (_t) => { appCalls.push(`tip:${_t}`); },
			Notify: () => undefined,
			SystemDark: () => false,
		};
		IpcHost.Register(fake.Ipc, win.Ops, app);
		const run = (_c: string, _a?: unknown): unknown => fake.Handlers.get(_c)?.(_a);
		run("window:minimize");
		assert.ok(win.Calls.includes("min"));
		run("window:maximize-toggle");
		assert.ok(win.Calls.includes("max"));
		run("window:maximize-toggle");
		assert.ok(win.Calls.includes("unmax"));
		assert.deepEqual(run("app:set-auto-start", { Enabled: true }), { Ok: true });
		assert.ok(appCalls.includes("auto:true"));
		assert.deepEqual(run("app:set-global-hotkey", { Accelerator: "Ctrl+X" }), { Ok: true });
		run("tray:set-tooltip", { Text: "hi" });
		assert.ok(appCalls.includes("tip:hi"));
		win.FireMaximize();
		assert.ok(win.Sent.some((_s) => _s.Channel === "window:maximized-changed" && _s.Args[0] === true));
		await win.Ops.CapturePage({ X: 0, Y: 0, Width: 1, Height: 1 });
	});

	void it("FileLogSink 가짜 시계 회전", async () =>
	{
		const dir = TempDir("filesink");
		let now = Date.parse("2026-09-01T00:00:00Z");
		const sink = new FileLogSink(dir, 7, () => now);
		const entry: ILogEntry = { Ts: now, Level: "info", Scope: "T", Msg: "one" };
		sink.Write(entry);
		await new Promise((_resolve) => setTimeout(_resolve, 700));
		assert.equal(fs.existsSync(path.join(dir, "app-20260901.log")), true);
		now = Date.parse("2026-09-09T00:00:00Z");
		sink.Write({ Ts: now, Level: "info", Scope: "T", Msg: "two" });
		await new Promise((_resolve) => setTimeout(_resolve, 700));
		assert.equal(fs.existsSync(path.join(dir, "app-20260901.log")), false);
		assert.equal(fs.existsSync(path.join(dir, "app-20260909.log")), true);
	});
});
