/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: 테마·크롬 E2E. 설정 전환, 스프라이트, 구분선, 문서 스크롤.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

const kPort = 9527;
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
	throw new Error("[E2E] ping 실패");
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
	const res = await Post("/test/eval", { Script: _script }) as { Value?: unknown };
	return res.Value;
}

void describe("Theme E2E", () =>
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

	void it("아이콘 스프라이트가 주입된다", async () =>
	{
		assert.equal(await Eval("!!document.getElementById(\"scouter-icon-sprite\")"), true);
		assert.equal(await Eval("!!document.querySelector(\"#scouter-icon-sprite #lucide-x\")"), true);
		assert.equal(await Eval("!!document.querySelector(\"#scouter-icon-sprite #lucide-pin\")"), true);
	});

	void it("타이틀바 버튼 4개가 보인다", async () =>
	{
		const count = await Eval("document.querySelector('[data-testid=\"title_bar\"]')?.querySelectorAll(\"button\").length ?? -1");
		assert.equal(count, 4);
		const empty = await Eval("[...document.querySelectorAll('[data-testid=\"title_bar\"] button use')].filter((_u) => !_u.getAttribute(\"href\")).length");
		assert.equal(empty, 0);
	});

	void it("타이틀 구분선이 전체 폭이다", async () =>
	{
		assert.equal(await Eval("!!document.querySelector('[data-testid=\"title_divider\"]')"), true);
		const widths = await Eval("(() => { const bar = document.querySelector('[data-testid=\"title_bar\"]'); const div = document.querySelector('[data-testid=\"title_divider\"]'); if (bar === null || div === null) return null; return [Math.round(bar.getBoundingClientRect().width), Math.round(div.getBoundingClientRect().width)]; })()") as [number, number] | null;
		assert.ok(widths !== null);
		assert.ok(Math.abs((widths)[0] - (widths)[1]) < 4);
	});

	void it("문서 레벨 세로 스크롤이 없다", async () =>
	{
		assert.equal(await Eval("document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1"), true);
	});

	void it("테마 전환이 data-theme에 반영된다", async () =>
	{
		await Post("/test/settings", { Path: "Theme.Id", Value: "tokyonight" });
		assert.equal(await Eval("document.documentElement.dataset[\"theme\"]"), "tokyonight");
		await Post("/test/settings", { Path: "Theme.Id", Value: "oc-2" });
		assert.equal(await Eval("document.documentElement.dataset[\"theme\"]"), "oc-2");
	});

	void it("스킴 전환이 data-scheme·배경에 반영된다", async () =>
	{
		await Post("/test/settings", { Path: "Theme.Scheme", Value: "Dark" });
		assert.equal(await Eval("document.documentElement.dataset[\"scheme\"]"), "dark");
		const darkBg = await Eval("getComputedStyle(document.documentElement).getPropertyValue(\"--background-base\").trim()");
		await Post("/test/settings", { Path: "Theme.Scheme", Value: "Light" });
		assert.equal(await Eval("document.documentElement.dataset[\"scheme\"]"), "light");
		const lightBg = await Eval("getComputedStyle(document.documentElement).getPropertyValue(\"--background-base\").trim()");
		assert.notEqual(darkBg, lightBg);
		await Post("/test/settings", { Path: "Theme.Scheme", Value: "System" });
	});
});
