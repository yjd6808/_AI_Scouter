/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P4Util E2E. fake p4 + 실 플러그인 → MCP 추출.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import * as path from "node:path";
import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

const kPort = 9523;
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

async function Post(_path: string, _body: unknown): Promise<unknown>
{
	const headers = new Headers();
	headers.append("content-type", "application/json");
	const res = await fetch(`${kBase}${_path}`, { method: "POST", headers, body: JSON.stringify(_body) });
	return res.json();
}

void describe("P4Util E2E", () =>
{
	before(async () =>
	{
		const fakeDir = path.resolve("Source/Scouter.Tests/Fixtures/P4");
		const systemPath = process.env["Path"] ?? process.env["PATH"] ?? "";
		child = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kPort), "--plugin-dir", "Plugins"], {
			stdio: "ignore",
			env: { ...process.env, Path: `${fakeDir};${systemPath}` },
		});
		await WaitReady();
	});

	after(() =>
	{
		child?.kill();
		child = null;
	});

	void it("fake 추출이 파일을 돌려준다", async () =>
	{
		await Post("/test/settings", { Path: "Plugins.P4Util.DefaultDepot", Value: "//fake/..." });
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport);
		try
		{
			const listed = await client.listTools();
			assert.ok(listed.tools.some((_t) => _t.name === "P4Util__ExtractFiles"));
			const called = await client.callTool({ name: "P4Util__ExtractFiles", arguments: { Depot: "//fake/...", From: 1, To: 40 } });
			const first = (called.content as Array<{ text?: string }>)[0]?.text ?? "";
			const parsed = JSON.parse(first) as { Count?: number; Files?: Array<{ DepotPath?: string }> };
			assert.equal(parsed.Count, 2);
			assert.ok((parsed.Files ?? []).some((_f) => _f.DepotPath === "//fake/main/a.cpp"));
		}
		finally
		{
			await client.close();
		}
	});
});
