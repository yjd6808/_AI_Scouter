/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ToastLab E2E. Notify 호출 → 토스트 DOM 확인. Message 호출 → 타임아웃 결과.
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

const kPort = 9528;
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

async function Eval(_script: string): Promise<unknown>
{
	const headers = new Headers();
	headers.append("content-type", "application/json");
	const res = await fetch(`${kBase}/test/eval`, { method: "POST", headers, body: JSON.stringify({ Script: _script }) });
	return res.json();
}

void describe("ToastLab E2E", () =>
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

	void it("Notify 호출이 토스트 DOM을 만든다", async () =>
	{
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const mark = `e2e-toast-${Date.now()}`;
			const back = await client.callTool({ name: "ToastLab__Notify", arguments: { Kind: "success", Title: mark } });
			const first = (back.content as Array<{ text?: string }>)[0]?.text ?? "";
			assert.ok(first.includes("true"));
			const seen = await Eval("(() => { const all = [...document.querySelectorAll('.gui-toast')]; return all.map((_el) => _el.textContent ?? ''); })()") as { Ok?: boolean; Value?: string[] };
			assert.ok((seen.Value ?? []).some((_t) => _t.includes(mark)));
			const global = await client.callTool({ name: "ToastLab__Notify", arguments: { Kind: "warn", Title: mark, Global: true } });
			const second = JSON.parse((global.content as Array<{ text?: string }>)[0]?.text ?? "{}") as { Ok?: boolean; Kind?: string; Global?: boolean };
			assert.equal(second.Ok, true);
			assert.equal(second.Kind, "warn");
			assert.equal(second.Global, true);
		}
		finally
		{
			await client.close();
		}
	});

	void it("Message App 호출은 타임아웃으로 닫힌다", async () =>
	{
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const back = await client.callTool({ name: "ToastLab__Message", arguments: { Scope: "App", Title: `e2e-msg-${Date.now()}`, Kind: "yesno", DurationSec: 1 } });
			const out = JSON.parse((back.content as Array<{ text?: string }>)[0]?.text ?? "{}") as { Ok?: boolean; Result?: string };
			assert.equal(out.Ok, true);
			assert.equal(out.Result, "timeout");
		}
		finally
		{
			await client.close();
		}
	});

	void it("Message Global 호출은 타임아웃으로 닫힌다", async () =>
	{
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const back = await client.callTool({ name: "ToastLab__Message", arguments: { Scope: "Global", Title: `e2e-gmsg-${Date.now()}`, Kind: "ok", DurationSec: 1 } });
			const out = JSON.parse((back.content as Array<{ text?: string }>)[0]?.text ?? "{}") as { Ok?: boolean; Scope?: string; Result?: string };
			assert.equal(out.Ok, true);
			assert.equal(out.Scope, "Global");
			assert.equal(out.Result, "timeout");
		}
		finally
		{
			await client.close();
		}
	});
});
