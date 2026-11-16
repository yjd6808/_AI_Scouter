/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScriptRunner E2E. Tool 7종 노출 → 등록 오버레이(기본 제목·인자 추가·스케줄링이 반복 수행을 켬)
	      → MCP 등록·대기 실행(한글 인자·종료 코드·출력) → 목록 행 입력란·즉시 실행 버튼
	      → 자식 프로세스까지 중지 → 2초 반복 예약 → 삭제.
	      실제 PowerShell을 띄우므로 Windows에서만 돈다. 테스트 스크립트는 임시 폴더에 덮어써 둔다.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

interface IFindResult
{
	Name?: string;
	Visible?: boolean;
	Enabled?: boolean;
}

interface IRunSummary
{
	RunId?: string;
	Trigger?: string;
	Result?: string;
	ExitCode?: number;
}

interface IItem
{
	Id: string;
	Title?: string;
	State?: string;
	RunCount?: number;
	LastRun?: IRunSummary | null;
}

interface IToolResult
{
	Text: string;
	IsError: boolean;
}

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

const kPort = 9533;
const kBase = `http://127.0.0.1:${kPort}`;
const kScriptDir = path.join(os.tmpdir(), "scouter-scriptrunner-e2e");
const kEchoScript = path.join(kScriptDir, "echo.ps1");
const kSleepScript = path.join(kScriptDir, "sleep.ps1");
const kChildPidFile = path.join(kScriptDir, "child.pid");
const kArgsPs1 = path.join(kScriptDir, "args.ps1");
const kArgsBat = path.join(kScriptDir, "args.bat");
const kIsWindows = process.platform === "win32";
let child: ChildProcess | null = null;

async function WaitReady(): Promise<void>
{
	for (let idx = 0; idx < 100; ++idx)
	{
		try
		{
			const res = await fetch(`${kBase}/test/ping`);
			if (res.ok)
				return;
		}
		catch
		{
			await new Promise((_resolve) => setTimeout(_resolve, 200));
		}
	}
	throw new Error("[E2E] ping 타임아웃");
}

async function Get(_path: string): Promise<unknown>
{
	const res = await fetch(`${kBase}${_path}`);
	return res.json();
}

async function Post(_path: string, _body: unknown): Promise<unknown>
{
	const headers = new Headers();
	headers.append("content-type", "application/json");
	const res = await fetch(`${kBase}${_path}`, { method: "POST", headers, body: JSON.stringify(_body) });
	return res.json();
}

function Sleep(_ms: number): Promise<void>
{
	return new Promise((_resolve) => setTimeout(_resolve, _ms));
}

async function Eval<T>(_script: string): Promise<T>
{
	const back = await Post("/test/eval", { Script: _script }) as { Ok?: boolean; Value?: T; Error?: string };
	if (back.Ok !== true)
		throw new Error(`[E2E] eval 실패: ${back.Error ?? ""}`);
	return back.Value as T;
}

async function CallTool(_name: string, _args: Record<string, unknown>): Promise<IToolResult>
{
	const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
	const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
	await client.connect(transport as unknown as Transport);
	try
	{
		const back = await client.callTool({ name: `ScriptRunner__${_name}`, arguments: _args });
		const text = (back.content as Array<{ text?: string }>)[0]?.text ?? "";
		return { Text: text, IsError: back.isError === true };
	}
	finally
	{
		await client.close();
	}
}

async function CallJson<T>(_name: string, _args: Record<string, unknown>): Promise<T>
{
	const back = await CallTool(_name, _args);
	if (back.IsError)
		throw new Error(`[E2E] ${_name} 실패: ${back.Text}`);
	return JSON.parse(back.Text) as T;
}

// 실행 로그 상자(textarea)의 지금 내용.
async function LogText(): Promise<string>
{
	return Eval<string>("document.querySelector('[data-testid=\"txt_log\"] textarea')?.value ?? ''");
}

async function FindItem(_id: string): Promise<IItem>
{
	const list = await CallJson<{ Items: IItem[] }>("List", { Id: _id });
	const item = list.Items[0];
	if (item === undefined)
		throw new Error(`[E2E] 항목 없음: ${_id}`);
	return item;
}

async function WaitFor(_check: () => Promise<boolean>, _timeoutMs: number): Promise<boolean>
{
	const until = Date.now() + _timeoutMs;
	while (Date.now() < until)
	{
		if (await _check())
			return true;
		await Sleep(250);
	}
	return false;
}

function IsAlive(_pid: number): boolean
{
	try
	{
		process.kill(_pid, 0);
		return true;
	}
	catch
	{
		return false;
	}
}

// PowerShell 5.1은 BOM 없는 .ps1을 ANSI로 읽는다. 한글이 들어가므로 UTF-8 BOM을 붙인다.
function WriteScripts(): void
{
	fs.mkdirSync(kScriptDir, { recursive: true });
	const echo = [
		"param([string]$Mode, [string]$Branch)",
		"Write-Output \"인자: $Mode $Branch\"",
		"Write-Host \"호스트 출력\"",
		"Write-Output \"작업 폴더: $((Get-Location).Path)\"",
		"exit ([int]$Mode)",
		"",
	].join("\r\n");
	const sleep = [
		"param([string]$PidFile)",
		"$c = Start-Process powershell -ArgumentList '-NoProfile','-Command','Start-Sleep -Seconds 60' -PassThru -WindowStyle Hidden",
		"[IO.File]::WriteAllText($PidFile, [string]$c.Id)",
		"Write-Output \"자식 PID $($c.Id)\"",
		"Wait-Process -Id $c.Id",
		"",
	].join("\r\n");
	fs.writeFileSync(kEchoScript, `﻿${echo}`, "utf-8");
	fs.writeFileSync(kSleepScript, `﻿${sleep}`, "utf-8");
	fs.writeFileSync(kChildPidFile, "", "utf-8");
	fs.writeFileSync(kArgsPs1, "param($A, $B, $C)\r\nWrite-Output \"A=[$A] B=[$B] C=[$C]\"\r\n", "utf-8");
	fs.writeFileSync(kArgsBat, "@echo A=[%~1] B=[%~2] C=[%~3]\r\n", "utf-8");
}

void describe("ScriptRunner E2E", { skip: !kIsWindows }, () =>
{
	before(async () =>
	{
		WriteScripts();
		child = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kPort), "--plugin-dir", "Plugins"], { stdio: "ignore" });
		await WaitReady();
		await Post("/test/approval", { Policy: "allow" });
		// ping이 와도 Plugin 로드는 아직일 수 있다. 사이드바 항목이 생긴 뒤 눌러야 화면이 열린다.
		const listed = await WaitFor(async () => (await Get("/test/find?name=nav_ScriptRunner") as IFindResult).Name === "nav_ScriptRunner", 20000);
		assert.ok(listed, "사이드바에 ScriptRunner가 없음");
		await Post("/test/click", { Name: "nav_ScriptRunner" });
		const shown = await WaitFor(async () => (await Get("/test/find?name=btn_add") as IFindResult).Visible === true, 10000);
		assert.ok(shown, "ScriptRunner 화면이 안 열림");
	});

	after(() =>
	{
		child?.kill();
		child = null;
	});

	void it("Tool 9종이 전부 노출된다", async () =>
	{
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const listed = await client.listTools();
			const names = listed.tools.map((_t) => _t.name);
			for (const tool of ["List", "Register", "Update", "Run", "Stop", "Remove", "GetOutput", "GetLog", "Preset"])
				assert.ok(names.includes(`ScriptRunner__${tool}`), tool);
		}
		finally
		{
			await client.close();
		}
	});

	void it("등록 오버레이: 기본 제목, 인자 추가, 스케줄링이 반복 수행을 켠다", async () =>
	{
		await Post("/test/click", { Name: "btn_add" });
		await Sleep(300);
		const overlay = await Get("/test/find?name=ovl_add") as IFindResult;
		assert.equal(overlay.Visible, true);
		const title = await Eval<string>("document.querySelector('[data-testid=\"txt_title\"] input')?.value ?? ''");
		assert.equal(title, "스크립트-1");
		assert.equal((await Get("/test/find?name=chk_repeat") as IFindResult).Enabled, false);
		assert.equal((await Get("/test/find?name=chk_keep_boot") as IFindResult).Enabled, false);
		await Post("/test/click", { Name: "chk_schedule" });
		await Sleep(200);
		assert.equal((await Get("/test/find?name=chk_repeat") as IFindResult).Enabled, true);
		assert.equal((await Get("/test/find?name=chk_keep_boot") as IFindResult).Enabled, true);
		assert.equal(await Eval<string>("document.querySelector('[data-testid=\"chk_keep_boot\"]')?.getAttribute('aria-pressed') ?? ''"), "false");
		await Post("/test/click", { Name: "btn_arg_add" });
		await Post("/test/click", { Name: "btn_arg_add" });
		await Sleep(200);
		assert.equal((await Get("/test/find?name=txt_form_arg_name_1") as IFindResult).Visible, true);
		await Post("/test/click", { Name: "btn_form_arg_remove_0" });
		await Sleep(200);
		assert.equal(await Eval<number>("document.querySelectorAll('[data-testid^=\"grid_form_arg_\"]').length"), 1);
		await Post("/test/click", { Name: "btn_add_close" });
		await Sleep(300);
		assert.equal((await Get("/test/find?name=ovl_add") as IFindResult).Visible, false);
	});

	void it("MCP 등록 → 대기 실행: 한글 인자·종료 코드·출력·작업 폴더", async () =>
	{
		const reg = await CallJson<{ Item: IItem }>("Register", {
			Title: "에코",
			Path: kEchoScript,
			Args: [{ Name: "Mode", Required: true }, { Name: "Branch", Required: false, Value: "루트" }],
		});
		const id = reg.Item.Id;
		const refused = await CallTool("Run", { Id: id });
		assert.equal(refused.IsError, true);
		assert.match(refused.Text, /Mode/);
		const run = await CallJson<{ Finished: boolean; LastRun: IRunSummary; Output: string }>("Run", { Id: id, ArgValues: { Mode: "3" }, Wait: true, WaitTimeoutSec: 60 });
		assert.equal(run.Finished, true);
		assert.equal(run.LastRun.Result, "Failed");
		assert.equal(run.LastRun.ExitCode, 3);
		assert.match(run.Output, /인자: 3 루트/);
		assert.match(run.Output, /호스트 출력/);
		const logged = await WaitFor(async () =>
		{
			const text = await LogText();
			return text.includes(`[${id} 에코] ▶ 실행 시작`) && text.includes(`[${id} 에코] 인자: 3 루트`) && text.includes(`[${id} 에코] ■ 실패 (3)`);
		}, 10000);
		assert.ok(logged, `실행 로그 상자: ${await LogText()}`);
		const viaTool = await CallJson<{ Lines: string[] }>("GetLog", { Id: id, Lines: 50 });
		assert.ok(viaTool.Lines.some((_l) => _l.endsWith("인자: 3 루트")), viaTool.Lines.join("\n"));
		assert.ok(run.Output.includes(kScriptDir), run.Output);
		const ok = await CallJson<{ LastRun: IRunSummary }>("Run", { Id: id, ArgValues: ["0"], Wait: true });
		assert.equal(ok.LastRun.Result, "Success");
		const output = await CallJson<{ Output: string; LastRun: IRunSummary }>("GetOutput", { Id: id });
		assert.match(output.Output, /인자: 0 루트/);
	});

	void it("부팅 표식을 실제로 읽고, KeepAfterBoot를 MCP로 켜고 끈다", async () =>
	{
		const restored = await WaitFor(async () =>
		{
			const logs = await Get("/test/logs") as Array<{ Msg?: string; Data?: { BootMarkMs?: number | null } }>;
			return logs.some((_l) => _l.Msg === "[ScriptRunner] 복원 완료" && (_l.Data?.BootMarkMs ?? 0) > 0);
		}, 20000);
		assert.ok(restored, "복원 로그에 부팅 표식이 없음");
		const reg = await CallJson<{ Item: IItem & { KeepAfterBoot?: boolean; NextDueAtMs?: number } }>("Register", {
			Path: kEchoScript, Args: [{ Name: "Mode", Value: "0" }], Schedule: "After", AfterSeconds: 3600, KeepAfterBoot: true,
		});
		assert.equal(reg.Item.KeepAfterBoot, true);
		const off = await CallJson<{ Item: IItem & { KeepAfterBoot?: boolean; NextDueAtMs?: number } }>("Update", { Id: reg.Item.Id, KeepAfterBoot: false });
		assert.equal(off.Item.KeepAfterBoot, false);
		assert.equal(off.Item.NextDueAtMs, reg.Item.NextDueAtMs);
		const plain = await CallJson<{ Item: IItem & { KeepAfterBoot?: boolean } }>("Register", { Path: kEchoScript, AfterSeconds: 3600 });
		assert.equal(plain.Item.KeepAfterBoot, false);
		await CallJson("Remove", { Id: reg.Item.Id });
		await CallJson("Remove", { Id: plain.Item.Id });
	});

	void it("가운데 빈 인자는 .ps1·.bat 모두 자리를 지킨다", async () =>
	{
		for (const script of [kArgsPs1, kArgsBat])
		{
			const reg = await CallJson<{ Item: IItem }>("Register", { Path: script, Args: [{ Name: "A" }, { Name: "B", Required: false }, { Name: "C" }] });
			const run = await CallJson<{ LastRun: IRunSummary; Output: string }>("Run", { Id: reg.Item.Id, ArgValues: ["1", "", "3"], Wait: true });
			assert.equal(run.LastRun.Result, "Success", run.Output);
			assert.match(run.Output, /A=\[1\] B=\[\] C=\[3\]/, script);
			await CallJson("Remove", { Id: reg.Item.Id });
		}
	});

	void it("목록 행: 인자 입력란에 저장 값이 보이고 즉시 실행 버튼이 돈다", async () =>
	{
		const list = await CallJson<{ Items: IItem[] }>("List", {});
		const echo = list.Items.find((_i) => _i.Title === "에코");
		assert.ok(echo !== undefined);
		await Sleep(1200);
		const value = await Eval<string>(`(() => { const el = document.querySelector('[data-testid="txt_arg_${echo.Id}_0"]'); const input = el?.matches('input') ? el : el?.querySelector('input'); return input?.value ?? ''; })()`);
		assert.equal(value, "0");
		const before = echo.LastRun?.RunId ?? "";
		await Post("/test/click", { Name: `btn_run_${echo.Id}` });
		const done = await WaitFor(async () =>
		{
			const item = await FindItem(echo.Id);
			return item.LastRun?.RunId !== before && item.LastRun?.Result === "Success";
		}, 30000);
		assert.ok(done);
		assert.equal((await FindItem(echo.Id)).LastRun?.Trigger, "Manual");
		const remain = await Eval<string>(`document.querySelector('[data-testid="txt_remain_${echo.Id}"]')?.textContent ?? ''`);
		assert.match(remain, /완료/);
	});

	void it("중지: 자식 프로세스까지 끝내고 결과는 Stopped", async () =>
	{
		const reg = await CallJson<{ Item: IItem; RunId: string }>("Register", {
			Title: "오래 걸림",
			Path: kSleepScript,
			Args: [{ Name: "PidFile", Value: kChildPidFile }],
			RunNow: true,
		});
		const id = reg.Item.Id;
		assert.ok(reg.RunId.length > 0);
		const started = await WaitFor(() => Promise.resolve(fs.readFileSync(kChildPidFile, "utf-8").trim().length > 0), 20000);
		assert.ok(started, "자식 PID 파일이 안 생김");
		const childPid = Number(fs.readFileSync(kChildPidFile, "utf-8").trim());
		const live = await WaitFor(async () => (await LogText()).includes(`[${id} 오래 걸림] 자식 PID ${childPid}`), 10000);
		assert.ok(live, "실행 중 출력이 실행 로그에 실시간으로 안 쌓임");
		assert.ok(IsAlive(childPid));
		const running = await CallJson<{ Items: IItem[] }>("List", { RunningOnly: true });
		assert.deepEqual(running.Items.map((_i) => _i.Id), [id]);
		const stopped = await CallJson<{ Stopped: number; LastRun: IRunSummary }>("Stop", { Id: id });
		assert.equal(stopped.Stopped, 1);
		assert.equal(stopped.LastRun.Result, "Stopped");
		const dead = await WaitFor(() => Promise.resolve(!IsAlive(childPid)), 10000);
		assert.ok(dead, `자식 프로세스 ${childPid}가 살아 있음`);
		await CallJson("Remove", { Id: id });
	});

	void it("프리셋: MCP 저장 → 행 콤보박스에서 고르면 입력란이 채워지고, 프리셋으로 실행한다", async () =>
	{
		const reg = await CallJson<{ Item: IItem }>("Register", {
			Title: "프리셋",
			Path: kEchoScript,
			Args: [{ Name: "Mode" }, { Name: "Branch", Required: false }],
		});
		const id = reg.Item.Id;
		await CallJson("Preset", { Id: id, Action: "Save", Name: "release", ArgValues: { Mode: "0", Branch: "release" } });
		await CallJson("Preset", { Id: id, Action: "Save", Name: "release-2", ArgValues: { Mode: "4", Branch: "X" } });
		const label = `document.querySelector('[data-testid="cmb_preset_${id}"] .gui-combobox__value')?.textContent ?? ''`;
		// 값을 따로 주어 저장했으므로 선택은 "없음" 그대로다(입력란 값과 다른 프리셋을 가리키지 않는다).
		assert.ok(await WaitFor(async () => (await Eval<string>(label)) === "없음", 5000), `콤보박스 표시: ${await Eval<string>(label)}`);
		const picked = await Eval<boolean>(`(async () => {
			const fire = (_el) => { const r = _el.getBoundingClientRect(); for (const t of ['pointerdown', 'pointerup']) _el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: r.left + 4, clientY: r.top + 4 })); };
			fire(document.querySelector('[data-testid="cmb_preset_${id}"] .gui-combobox__toggle'));
			await new Promise((_r) => setTimeout(_r, 250));
			const item = [...document.querySelectorAll('.gui-listbox *')].find((_e) => _e.children.length === 0 && (_e.textContent ?? '').trim() === 'release');
			if (item === undefined) return false;
			item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
			return true;
		})()`);
		assert.ok(picked, "드롭다운에서 release 항목을 못 찾음");
		const branch = `document.querySelector('[data-testid="txt_arg_${id}_1"] input')?.value ?? ''`;
		assert.ok(await WaitFor(async () => (await Eval<string>(branch)) === "release", 5000), `입력란: ${await Eval<string>(branch)}`);
		const listed = await FindItem(id) as IItem & { SelectedPreset?: string };
		assert.equal(listed.SelectedPreset, "release");
		const run = await CallJson<{ LastRun: IRunSummary; Output: string }>("Run", { Id: id, Preset: "release-2", Wait: true });
		assert.equal(run.LastRun.ExitCode, 4);
		assert.match(run.Output, /인자: 4 X/);
		assert.ok(await WaitFor(async () => (await Eval<string>(branch)) === "X", 5000));
		await CallJson("Remove", { Id: id });
	});

	void it("반복 예약: 2초마다 실행되고 예약 해제하면 멈춘다", async () =>
	{
		const reg = await CallJson<{ Item: IItem }>("Register", {
			Title: "반복",
			Path: kEchoScript,
			Args: [{ Name: "Mode", Value: "0" }],
			Schedule: "After",
			AfterSeconds: 2,
			Repeat: true,
		});
		const id = reg.Item.Id;
		assert.equal(reg.Item.State, "Scheduled");
		const twice = await WaitFor(async () => ((await FindItem(id)).RunCount ?? 0) >= 2, 15000);
		assert.ok(twice);
		assert.equal((await FindItem(id)).LastRun?.Trigger, "Schedule");
		const off = await CallJson<{ Item: IItem }>("Update", { Id: id, Schedule: "None" });
		assert.notEqual(off.Item.State, "Scheduled");
		await WaitFor(async () => (await FindItem(id)).State === "Idle", 10000);
		const count = (await FindItem(id)).RunCount ?? 0;
		await Sleep(3000);
		assert.equal((await FindItem(id)).RunCount, count);
		const removed = await CallJson<{ Ok: boolean }>("Remove", { Id: id });
		assert.equal(removed.Ok, true);
		const missing = await CallTool("GetOutput", { Id: id });
		assert.equal(missing.IsError, true);
	});
});
