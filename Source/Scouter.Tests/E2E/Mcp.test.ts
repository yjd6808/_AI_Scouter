/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MCP E2E. 실 Electron 기동 → Tool 목록 → 스니펫 재접속.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

const kPort = 9522;
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

async function MakeClient(_url: string, _token: string): Promise<Client>
{
	const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
	const transport = new StreamableHTTPClientTransport(new URL(`${_url}/mcp`), {
		requestInit: { headers: { Authorization: `Bearer ${_token}` } },
	});
	await client.connect(transport);
	return client;
}

void describe("Mcp E2E", () =>
{
	before(async () =>
	{
		child = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kPort)], { stdio: "ignore" });
		await WaitReady();
	});

	after(() =>
	{
		child?.kill();
		child = null;
	});

	void it("ScouterCore Tool 19개가 목록에 있다", async () =>
	{
		const health = await (await fetch(`${kBase}/health`)).json() as { Tools?: number };
		assert.ok((health.Tools ?? 0) >= 19);
	});

	void it("ConnectSnippet 결과로 재접속된다", async () =>
	{
		const first = await MakeClient(kBase, "");
		const called = await first.callTool({ name: "ScouterCore__ConnectSnippet", arguments: { Client: "Claude Code" } });
		const snippet = (called.content as Array<{ text?: string }>)[0]?.text ?? "";
		const parsed = JSON.parse(snippet) as { mcpServers?: { scouter?: { url?: string; headers?: { Authorization?: string } } } };
		const url = parsed.mcpServers?.scouter?.url ?? "";
		const token = (parsed.mcpServers?.scouter?.headers?.Authorization ?? "").replace(/^Bearer /, "");
		assert.ok(url.includes("/mcp"));
		assert.ok(token.length > 0);
		await first.close();
		const second = await MakeClient(url.slice(0, -"/mcp".length), token);
		const listed = await second.listTools();
		assert.ok(listed.tools.some((_t) => _t.name === "ScouterCore__ThemeList"));
		await second.close();
	});
});
