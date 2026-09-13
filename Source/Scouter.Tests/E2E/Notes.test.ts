/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Notes E2E. 추가 → 읽기 회귀.
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

const kPort = 9526;
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

void describe("Notes E2E", () =>
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

	void it("추가한 항목이 읽힌다", async () =>
	{
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const listed = await client.listTools();
			assert.ok(listed.tools.some((_t) => _t.name === "Notes__Append"));
			const mark = `e2e-${Date.now()}`;
			await client.callTool({ name: "Notes__Append", arguments: { Note: "e2e", Text: mark } });
			const back = await client.callTool({ name: "Notes__Read", arguments: { Note: "e2e" } });
			const first = (back.content as Array<{ text?: string }>)[0]?.text ?? "";
			assert.ok(first.includes(mark));
			const searched = await client.callTool({ name: "Notes__Search", arguments: { Query: mark } });
			const found = (searched.content as Array<{ text?: string }>)[0]?.text ?? "";
			assert.ok(found.includes("e2e"));
		}
		finally
		{
			await client.close();
		}
	});

	void it("노트 화면의 목록·본문이 패널을 채운다", async () =>
	{
		await Post("/test/click", { Name: "nav_Notes" });
		await new Promise((_resolve) => setTimeout(_resolve, 500));
		const list = await Get("/test/find?name=lst_notes") as { Rect?: { Width?: number; Height?: number } };
		const body = await Get("/test/find?name=txt_body") as { Rect?: { Width?: number; Height?: number } };
		assert.ok((list.Rect?.Height ?? 0) > 100);
		assert.ok((body.Rect?.Height ?? 0) > 300);
		assert.ok((body.Rect?.Width ?? 0) > 200);
	});

	void it("화면에서 제목·본문 쓰고 저장하면 읽힌다", async () =>
	{
		const name = `e2e-ui-${Date.now()}`;
		const typedTitle = await Post("/test/eval", {
			Script: "(() => { const el = document.querySelector('[data-testid=\"txt_title\"] input'); if (el === null) return false; el.value = '" + name + "'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()",
		}) as { Ok?: boolean; Value?: unknown };
		assert.equal(typedTitle.Value, true);
		await Post("/test/click", { Name: "btn_new" });
		const typedBody = await Post("/test/eval", {
			Script: "(() => { const el = document.querySelector('[data-testid=\"txt_body\"] textarea'); if (el === null) return false; el.value = 'ui-body'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()",
		}) as { Ok?: boolean; Value?: unknown };
		assert.equal(typedBody.Value, true);
		await Post("/test/click", { Name: "btn_save" });
		await new Promise((_resolve) => setTimeout(_resolve, 800));
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const back = await client.callTool({ name: "Notes__Read", arguments: { Note: name } });
			const first = (back.content as Array<{ text?: string }>)[0]?.text ?? "";
			assert.ok(first.includes("ui-body"));
		}
		finally
		{
			await client.close();
		}
	});
});
