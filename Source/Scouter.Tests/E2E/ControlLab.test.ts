/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ControlLab E2E. Log 기록 후 State 확인 + 화면 진입 확인.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

const kPort = 9529;
const kBase = `http://127.0.0.1:${kPort}`;
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

void describe("ControlLab E2E", () =>
{
	before(async () =>
	{
		child = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kPort), "--plugin-dir", "Plugins"], { stdio: "ignore" });
		await WaitReady();
	});

	after(() =>
	{
		child?.kill();
		child = null;
	});

	void it("Log 후 State에 쌓인다", async () =>
	{
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const mark = `e2e-lab-${Date.now()}`;
			const back = await client.callTool({ name: "ControlLab__Log", arguments: { Kind: "warn", Name: mark, Detail: "d" } });
			const first = JSON.parse((back.content as Array<{ text?: string }>)[0]?.text ?? "{}") as { Ok?: boolean; Count?: number };
			assert.equal(first.Ok, true);
			assert.ok((first.Count ?? 0) >= 1);
			const state = await client.callTool({ name: "ControlLab__State", arguments: { Limit: 5 } });
			const out = JSON.parse((state.content as Array<{ text?: string }>)[0]?.text ?? "{}") as { Ok?: boolean; Events?: Array<{ Name: string }> };
			assert.equal(out.Ok, true);
			assert.ok((out.Events ?? []).some((_e) => _e.Name === mark));
		}
		finally
		{
			await client.close();
		}
	});

	void it("사이드바에서 화면이 열린다", async () =>
	{
		await Post("/test/click", { Name: "nav_ControlLab" });
		await new Promise((_resolve) => setTimeout(_resolve, 500));
		const found = await Get("/test/find?name=btn_primary") as { Rect?: { Width?: number; Height?: number } };
		assert.ok((found.Rect?.Width ?? 0) > 0);
		assert.ok((found.Rect?.Height ?? 0) > 0);
		const list = await Get("/test/find?name=lst_demo") as { TypeName?: string };
		assert.equal(list.TypeName, "ListBox");
		const code = await Get("/test/find?name=code_demo") as { TypeName?: string };
		assert.equal(code.TypeName, "CodeEditor");
		const strip = await Post("/test/eval", {
			Script: "(() => document.querySelectorAll('.gui-tab').length)()",
		}) as { Ok?: boolean; Value?: unknown };
		assert.equal(strip.Value, 5);
		const wrapFont = await Post("/test/eval", {
			Script: "(() => getComputedStyle(document.querySelector('[data-testid=\"txt_wrap\"]')).fontSize)()",
		}) as { Ok?: boolean; Value?: unknown };
		assert.equal(wrapFont.Value, "15px");
	});

	void it("탭을 누르면 스트립 선택과 본문이 바뀐다", async () =>
	{
		const switched = await Post("/test/eval", {
			Script: "(() => { const btn = [...document.querySelectorAll('.gui-tab')].find((_el) => (_el.textContent ?? '').includes('Scouter')); if (btn === undefined) return 'missing'; btn.click(); return 'ok'; })()",
		}) as { Ok?: boolean; Value?: unknown };
		assert.equal(switched.Value, "ok");
		await new Promise((_resolve) => setTimeout(_resolve, 300));
		const selected = await Post("/test/eval", {
			Script: "(() => document.querySelector('.gui-tab.is-selected')?.textContent ?? '')()",
		}) as { Ok?: boolean; Value?: unknown };
		assert.equal(selected.Value, "Scouter");
		const back = await Post("/test/eval", {
			Script: "(() => { const btn = [...document.querySelectorAll('.gui-tab')].find((_el) => (_el.textContent ?? '').includes('버튼')); if (btn === undefined) return 'missing'; btn.click(); return document.querySelector('.gui-tab.is-selected')?.textContent ?? ''; })()",
		}) as { Ok?: boolean; Value?: unknown };
		assert.equal(back.Value, "버튼");
	});
});
