/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: SidebarNotice E2E. 파일 변경 red dot, 우클릭·F5 리로드, 깨진 TS 느낌표.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

const kPort = 9530;
const kBase = `http://127.0.0.1:${kPort}`;
const kProbeCss = join(process.cwd(), "Plugins", "ControlLab", "__notice_probe.css");
const kStoreTs = join(process.cwd(), "Plugins", "ControlLab", "ControlStore.ts");
const kBrokenTail = "\nconst __notice_probe__ = {{{;\n";
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

async function Eval(_script: string): Promise<unknown>
{
	return Post("/test/eval", { Script: _script });
}

async function Poll(_script: string, _want: unknown, _tries = 25): Promise<unknown>
{
	for (let idx = 0; idx < _tries; ++idx)
	{
		const back = await Eval(_script) as { Value?: unknown };
		if (JSON.stringify(back.Value) === JSON.stringify(_want))
			return back.Value;
		await new Promise((_resolve) => setTimeout(_resolve, 200));
	}
	const last = await Eval(_script) as { Value?: unknown };
	return last.Value;
}

function CleanProbes(): void
{
	try
	{
		rmSync(kProbeCss, { force: true });
	}
	catch
	{
		// 무시.
	}
	try
	{
		const text = readFileSync(kStoreTs, "utf-8");
		if (text.endsWith(kBrokenTail))
			writeFileSync(kStoreTs, text.slice(0, text.length - kBrokenTail.length));
	}
	catch
	{
		// 무시.
	}
}

void describe("SidebarNotice E2E", () =>
{
	before(async () =>
	{
		CleanProbes();
		child = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kPort), "--plugin-dir", "Plugins"], { stdio: "ignore" });
		await WaitReady();
		await Post("/test/click", { Name: "nav_ControlLab" });
		await new Promise((_resolve) => setTimeout(_resolve, 800));
	});

	after(() =>
	{
		CleanProbes();
		child?.kill();
		child = null;
	});

	void it("css 변경이면 사이드바에 red dot", async () =>
	{
		writeFileSync(kProbeCss, "/* notice probe */\n");
		const seen = await Poll("(() => document.querySelector('[data-testid=\"nav_ControlLab\"] .gui-navitem__dot') !== null)()", true);
		assert.equal(seen, true);
	});

	void it("우클릭 메뉴 다시 로드하면 dot 해제", async () =>
	{
		const opened = await Eval("(() => { const btn = document.querySelector('[data-testid=\"nav_ControlLab\"]'); if (btn === null) return 'missing'; btn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })); return document.querySelector('.gui-contextmenu') !== null || document.querySelector('.gui-popup') !== null; })()");
		assert.equal((opened as { Value?: unknown }).Value, true);
		const clicked = await Post("/test/click", { Name: "reload_ControlLab" }) as { Ok?: boolean };
		assert.equal(clicked.Ok, true);
		const gone = await Poll("(() => document.querySelector('[data-testid=\"nav_ControlLab\"] .gui-navitem__dot') !== null)()", false, 40);
		assert.equal(gone, false);
	});

	void it("F5를 누르면 다시 로드되고 dot 해제", async () =>
	{
		writeFileSync(kProbeCss, "/* notice probe 2 */\n");
		const seen = await Poll("(() => document.querySelector('[data-testid=\"nav_ControlLab\"] .gui-navitem__dot') !== null)()", true);
		assert.equal(seen, true);
		await Eval("(() => { const btn = document.querySelector('[data-testid=\"nav_ControlLab\"]'); (btn ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', code: 'F5', bubbles: true, cancelable: true })); return true; })()");
		const gone = await Poll("(() => document.querySelector('[data-testid=\"nav_ControlLab\"] .gui-navitem__dot') !== null)()", false, 40);
		assert.equal(gone, false);
	});

	void it("깨진 TS를 리로드하면 느낌표", async () =>
	{
		const orig = readFileSync(kStoreTs, "utf-8");
		assert.equal(orig.endsWith(kBrokenTail), false);
		writeFileSync(kStoreTs, orig + kBrokenTail);
		try
		{
			const dirty = await Poll("(() => document.querySelector('[data-testid=\"nav_ControlLab\"] .gui-navitem__dot') !== null)()", true);
			assert.equal(dirty, true);
			await Eval("(() => { const btn = document.querySelector('[data-testid=\"nav_ControlLab\"]'); (btn ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', code: 'F5', bubbles: true, cancelable: true })); return true; })()");
			const alert = await Poll("(() => { const el = document.querySelector('[data-testid=\"nav_ControlLab\"] .gui-navitem__alert'); return el === null ? '' : (el.textContent ?? ''); })()", "!", 60);
			assert.equal(alert, "!");
		}
		finally
		{
			writeFileSync(kStoreTs, orig);
		}
		const redirty = await Poll("(() => document.querySelector('[data-testid=\"nav_ControlLab\"] .gui-navitem__dot') !== null)()", true);
		assert.equal(redirty, true);
		await Eval("(() => { const btn = document.querySelector('[data-testid=\"nav_ControlLab\"]'); (btn ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', code: 'F5', bubbles: true, cancelable: true })); return true; })()");
		const clean = await Poll("(() => document.querySelector('[data-testid=\"nav_ControlLab\"] .gui-navitem__dot') !== null || document.querySelector('[data-testid=\"nav_ControlLab\"] .gui-navitem__alert') !== null)()", false, 60);
		assert.equal(clean, false);
	});
});
