/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P4Util E2E. fake p4 + 실 플러그인 → MCP 추출.
	모드 분기: SCOUTER_P4_MODE=fake(기본, Fixtures/P4/p4.cmd) / real(실제 p4 서버).
	real 서버가 non-unicode면 P4Charset을 빈 문자열로 두어 P4CHARSET 강제를 끈다.
*/

import { describe, it, before, after } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import * as path from "node:path";
import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

// fake(p4.cmd) 경로와 실제 p4 실행을 if문으로 구분한다.
const kP4Mode = process.env["SCOUTER_P4_MODE"] ?? "fake";
const kIsReal = kP4Mode === "real";

const kRealDepot = process.env["SCOUTER_P4_DEPOT"] ?? "//depot/...";
const kRealFrom = Number(process.env["SCOUTER_P4_FROM"] ?? "580049");
const kRealTo = Number(process.env["SCOUTER_P4_TO"] ?? "580053");
const kRealCharset = process.env["SCOUTER_P4_CHARSET"] ?? "";

const kFakePort = 9523;
const kFakeBase = `http://127.0.0.1:${kFakePort}`;
let fakeChild: ChildProcess | null = null;

const kRealPort = 9524;
const kRealBase = `http://127.0.0.1:${kRealPort}`;
let realChild: ChildProcess | null = null;
let realReady = false;

async function WaitReady(_base: string): Promise<void>
{
	for (let idx = 0; idx < 100; ++idx)
	{
		try
		{
			const res = await fetch(`${_base}/test/ping`);
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

async function Post(_base: string, _path: string, _body: unknown): Promise<unknown>
{
	const headers = new Headers();
	headers.append("content-type", "application/json");
	const res = await fetch(`${_base}${_path}`, { method: "POST", headers, body: JSON.stringify(_body) });
	return res.json();
}

function ProbeReal(): boolean
{
	try
	{
		const result = spawnSync("p4", ["info"], { stdio: "ignore" });
		return result.status === 0;
	}
	catch
	{
		return false;
	}
}

void describe("P4Util E2E fake", () =>
{
	before(async () =>
	{
		const fakeDir = path.resolve("Source/Scouter.Tests/Fixtures/P4");
		const systemPath = process.env["Path"] ?? process.env["PATH"] ?? "";
		fakeChild = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kFakePort), "--plugin-dir", "Plugins"], {
			stdio: "ignore",
			env: { ...process.env, Path: `${fakeDir};${systemPath}` },
		});
		await WaitReady(kFakeBase);
	});

	after(() =>
	{
		fakeChild?.kill();
		fakeChild = null;
	});

	void it("fake 추출이 파일을 돌려준다", async () =>
	{
		await Post(kFakeBase, "/test/settings", { Path: "Plugins.P4Util.DefaultDepot", Value: "//fake/..." });
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kFakeBase}/mcp`));
		await client.connect(transport as unknown as Transport);
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

void describe("P4Util E2E real", () =>
{
	before(async () =>
	{
		if (!kIsReal)
			return;
		if (!ProbeReal())
			return;
		realChild = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kRealPort), "--plugin-dir", "Plugins"], {
			stdio: "ignore",
		});
		await WaitReady(kRealBase);
		realReady = true;
	});

	after(() =>
	{
		realChild?.kill();
		realChild = null;
		realReady = false;
	});

	void it("real 추출이 파일을 돌려준다", async (_t: TestContext) =>
	{
		if (!kIsReal)
		{
			_t.skip("SCOUTER_P4_MODE=real일 때만 실행");
			return;
		}
		if (!ProbeReal())
		{
			_t.skip("실제 p4 서버에 닿지 않음");
			return;
		}
		if (!realReady)
		{
			_t.skip("real Electron 기동 실패");
			return;
		}
		await Post(kRealBase, "/test/settings", { Path: "Plugins.P4Util.P4Charset", Value: kRealCharset });
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kRealBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const listed = await client.listTools();
			assert.ok(listed.tools.some((_tool) => _tool.name === "P4Util__ExtractFiles"));
			const called = await client.callTool({ name: "P4Util__ExtractFiles", arguments: { Depot: kRealDepot, From: kRealFrom, To: kRealTo } });
			const first = (called.content as Array<{ text?: string }>)[0]?.text ?? "";
			const parsed = JSON.parse(first) as { Count?: number; Files?: Array<{ DepotPath?: string }> };
			assert.ok((parsed.Count ?? 0) > 0);
			assert.ok((parsed.Files ?? []).length > 0);
		}
		finally
		{
			await client.close();
		}
	});
});
