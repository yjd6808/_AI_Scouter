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
});
