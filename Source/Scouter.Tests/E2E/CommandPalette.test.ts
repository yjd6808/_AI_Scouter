/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CommandPalette E2E. 열기 → 검색 → 실행 → 토글 닫기.
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

const kPort = 9525;
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

async function Eval(_script: string): Promise<{ Ok?: boolean; Value?: unknown }>
{
	const headers = new Headers();
	headers.append("content-type", "application/json");
	const res = await fetch(`${kBase}/test/eval`, { method: "POST", headers, body: JSON.stringify({ Script: _script }) });
	return res.json() as Promise<{ Ok?: boolean; Value?: unknown }>;
}

async function IsPaletteOpen(): Promise<boolean>
{
	const result = await Eval("(() => { return document.querySelector(\".gui-layer[data-layer=Popup] input\") !== null; })()");
	return result.Value === true;
}

async function WaitPalette(_open: boolean): Promise<boolean>
{
	for (let idx = 0; idx < 50; ++idx)
	{
		if (await IsPaletteOpen() === _open)
			return true;
		await new Promise((_resolve) => setTimeout(_resolve, 200));
	}
	return false;
}

async function GetSetting(_path: string): Promise<unknown>
{
	const res = await fetch(`${kBase}/test/settings?path=${_path}`);
	const body = await res.json() as { Value?: unknown };
	return body.Value;
}

async function OpenPalette(_client: Client): Promise<void>
{
	await _client.callTool({ name: "ScouterCore__CommandExecute", arguments: { Name: "CommandPalette.Open" } });
}

void describe("CommandPalette E2E", () =>
{
	before(async () =>
	{
		child = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kPort), "--plugin-dir", "Plugins"], { stdio: "ignore" });
		await WaitReady();
		const headers = new Headers();
		headers.append("content-type", "application/json");
		await fetch(`${kBase}/test/approval`, { method: "POST", headers, body: JSON.stringify({ Policy: "allow" }) });
	});

	after(() =>
	{
		child?.kill();
		child = null;
	});

	void it("열기 → 검색 → 실행으로 사이드바가 접힌다", async () =>
	{
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const listed = await client.listTools();
			assert.ok(listed.tools.some((_t) => _t.name === "ScouterCore__CommandExecute"));
			await OpenPalette(client);
			assert.equal(await WaitPalette(true), true);
			const typed = await Eval("(() => { const layer = document.querySelector('.gui-layer[data-layer=\"Popup\"]'); const input = layer === null ? null : layer.querySelector(\"input\"); if (input === null) return { ok: false }; input.focus(); input.value = \"togglesidebar\"; input.dispatchEvent(new Event(\"input\", { bubbles: true })); return { ok: true }; })()");
			assert.equal((typed.Value as { ok?: boolean } | undefined)?.ok, true);
			await Eval("(() => { const input = document.querySelector('.gui-layer[data-layer=\"Popup\"] input'); if (input === null) return { ok: false }; input.dispatchEvent(new KeyboardEvent(\"keydown\", { key: \"Enter\", bubbles: true, cancelable: true })); return { ok: true }; })()");
			let collapsed: unknown = null;
			for (let idx = 0; idx < 50; ++idx)
			{
				collapsed = await GetSetting("Ui.SidebarCollapsed");
				if (collapsed === true)
					break;
				await new Promise((_resolve) => setTimeout(_resolve, 200));
			}
			assert.equal(collapsed, true);
		}
		finally
		{
			await client.close();
		}
	});

	void it("열려 있을 때 Open이면 닫힌다", async () =>
	{
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			await OpenPalette(client);
			assert.equal(await WaitPalette(true), true);
			await OpenPalette(client);
			assert.equal(await WaitPalette(false), true);
		}
		finally
		{
			await client.close();
		}
	});
});
