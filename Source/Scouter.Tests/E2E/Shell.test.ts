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

	void it("접으면 사이드바가 숨고 펼치기 탭으로 돌아온다", async () =>
	{
		const hidden = await Get("/test/find?name=sidebar") as { Visible?: boolean; Rect?: { Width?: number } };
		assert.equal(hidden.Visible, false);
		assert.equal(hidden.Rect?.Width, 0);
		await Post("/test/click", { Name: "btn_expand" });
		const shown = await Get("/test/find?name=sidebar") as { Visible?: boolean };
		assert.equal(shown.Visible, true);
	});

	void it("스플리터 드래그로 사이드바 너비가 바뀐다", async () =>
	{
		const before = await Get("/test/settings?path=Ui.SidebarWidth") as { Value?: number };
		const script = "(() => { const el = document.querySelector('[data-testid=\"splitter\"]'); if (el === null) return 'no-splitter'; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2; const fire = (t, cx) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: cx, clientY: y })); fire('pointerdown', x); fire('pointermove', x + 60); fire('pointerup', x + 60); return 'ok'; })()";
		const drag = await Post("/test/eval", { Script: script }) as { Ok?: boolean; Value?: unknown };
		assert.equal(drag.Value, "ok");
		const after = await Get("/test/settings?path=Ui.SidebarWidth") as { Value?: number };
		assert.ok(Math.abs((after.Value ?? 0) - ((before.Value ?? 0) + 60)) <= 20);
	});
});
