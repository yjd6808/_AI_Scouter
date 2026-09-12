/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Shell E2E. --test 기동 → plugin_list 확인 → Ctrl+B 접기.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

const kPort = 9521;
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

void describe("Shell E2E", () =>
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

	void it("plugin_list이 트리에 있다", async () =>
	{
		const found = await Get("/test/find?name=plugin_list") as { Name?: string };
		assert.equal(found.Name, "plugin_list");
	});

	void it("btn_collapse 클릭이면 SidebarCollapsed", async () =>
	{
		await Post("/test/click", { Name: "btn_collapse" });
		const state = await Get("/test/settings?path=Ui.SidebarCollapsed") as { Value?: boolean };
		assert.equal(state.Value, true);
	});
});
