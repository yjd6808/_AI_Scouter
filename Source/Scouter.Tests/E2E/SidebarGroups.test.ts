/*
	작성자: 윤정도
	생성일: 2026-09-14
	=====
	설명: SidebarGroups E2E. 그룹 접기 유지, 그룹 추가 → 이름 변경, 항목 그룹 이동, 숨겨짐 그룹 검색 제외, 그룹 간 드래그 앤 드롭.
	--test 기동은 userData가 PID별 임시 폴더라 재시작 대신 저장 파일을 직접 읽어 다음 기동에서 살아남을 값인지 본다.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

const kPort = 9531;
const kBase = `http://127.0.0.1:${kPort}`;
const kProbeId = "ControlLab";
let child: ChildProcess | null = null;

interface ISavedGroup
{
	Id: string;
	Name: string;
	Collapsed: boolean;
	Items: string[];
}

async function Wait(_ms: number): Promise<void>
{
	await new Promise((_resolve) => setTimeout(_resolve, _ms));
}

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
			await Wait(200);
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

async function Eval(_script: string): Promise<unknown>
{
	const back = await Post("/test/eval", { Script: _script }) as { Value?: unknown };
	return back.Value;
}

async function Poll(_script: string, _want: unknown, _tries = 30): Promise<unknown>
{
	for (let idx = 0; idx < _tries; ++idx)
	{
		const value = await Eval(_script);
		if (JSON.stringify(value) === JSON.stringify(_want))
			return value;
		await Wait(200);
	}
	return Eval(_script);
}

async function NavVisible(_id: string): Promise<unknown>
{
	return Eval(`(() => document.querySelector('[data-testid="nav_${_id}"]') !== null)()`);
}

async function OpenContextMenu(_testId: string): Promise<void>
{
	await Eval(`(() => { const el = document.querySelector('[data-testid="${_testId}"]'); if (el === null) return false; el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })); return true; })()`);
	await Wait(200);
}

async function Filter(_text: string): Promise<void>
{
	await Eval(`(() => { const input = document.querySelector('[data-testid="txt_plugin_filter"] input'); if (input === null) return false; input.value = ${JSON.stringify(_text)}; input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
	await Wait(200);
}

// 드롭 지점 판정은 elementFromPoint로 하므로 합성 포인터 이벤트로도 실제 좌표 hit-testing이 그대로 재현된다.
// 누름은 항목 버튼에, 이동·뗌은 창에 보낸다. 컨트롤러가 창 단위로 듣기 때문이다.
async function Drag(_fromId: string, _toId: string): Promise<unknown>
{
	return Eval(`(() => {
		const from = document.querySelector('[data-testid="${_fromId}"]');
		const to = document.querySelector('[data-testid="${_toId}"]');
		if (from === null || to === null)
			return 'nofind';
		const a = from.getBoundingClientRect();
		const b = to.getBoundingClientRect();
		const at = { clientX: b.left + 12, clientY: b.top + b.height / 4, bubbles: true, cancelable: true, button: 0, pointerId: 1, isPrimary: true };
		from.dispatchEvent(new PointerEvent('pointerdown', { clientX: a.left + 12, clientY: a.top + a.height / 2, bubbles: true, cancelable: true, button: 0, pointerId: 1, isPrimary: true }));
		window.dispatchEvent(new PointerEvent('pointermove', at));
		const mark = ['is-drop-into', 'is-drop-before', 'is-drop-after'].find((_name) => to.classList.contains(_name)) ?? 'none';
		window.dispatchEvent(new PointerEvent('pointerup', at));
		return mark;
	})()`);
}

async function Mark(_testId: string): Promise<unknown>
{
	return Eval(`(() => { const el = document.querySelector('[data-testid="${_testId}"]'); if (el === null) return false; el.setAttribute('data-keep', '1'); return true; })()`);
}

async function Kept(_testId: string): Promise<unknown>
{
	return Eval(`(() => document.querySelector('[data-testid="${_testId}"]')?.getAttribute('data-keep') ?? 'gone')()`);
}

async function LiveGroups(): Promise<ISavedGroup[]>
{
	const back = await Get("/test/settings?path=Ui.PluginGroups") as { Value?: { External?: ISavedGroup[] } };
	return back.Value?.External ?? [];
}

function SavedGroups(): ISavedGroup[]
{
	const file = join(tmpdir(), `scouter-test-${String(child?.pid ?? 0)}`, ".scouter", "settings.json");
	const json = JSON.parse(readFileSync(file, "utf-8")) as { Ui?: { PluginGroups?: { External?: ISavedGroup[] } } };
	return json.Ui?.PluginGroups?.External ?? [];
}

function GroupOf(_groups: ISavedGroup[], _id: string): ISavedGroup | null
{
	return _groups.find((_group) => _group.Id === _id) ?? null;
}

void describe("SidebarGroups E2E", () =>
{
	before(async () =>
	{
		child = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kPort), "--plugin-dir", "Plugins"], { stdio: "ignore" });
		await WaitReady();
		await Wait(1200);
	});

	after(() =>
	{
		child?.kill();
		child = null;
	});

	void it("그룹 헤더를 접으면 항목이 숨고 접힘이 설정 파일까지 남는다", async () =>
	{
		assert.equal(await Poll(`(() => document.querySelector('[data-testid="nav_${kProbeId}"]') !== null)()`, true), true);
		const clicked = await Post("/test/click", { Name: "group_External_default" }) as { Ok?: boolean };
		assert.equal(clicked.Ok, true);
		assert.equal(await Poll(`(() => document.querySelector('[data-testid="nav_${kProbeId}"]') !== null)()`, false), false);
		assert.equal(GroupOf(await LiveGroups(), "default")?.Collapsed, true);
		await Wait(700);
		assert.equal(GroupOf(SavedGroups(), "default")?.Collapsed, true);	// 다음 기동에서 읽힐 값.
		await Post("/test/settings", { Path: "Ui.SidebarSort", Value: "Custom" });	// 전체 재동기화를 강제해도 접힘은 유지된다.
		await Wait(300);
		assert.equal(await NavVisible(kProbeId), false);
		assert.equal(await Eval("(() => document.querySelector('[data-testid=\"group_External_default\"]')?.classList.contains('is-folded') ?? false)()"), true);
		assert.equal(await Eval("(() => document.querySelector('[data-testid=\"group_External_hidden\"]')?.classList.contains('is-collapsed') ?? true)()"), false);	// 프레임워크 표시 클래스와 겹치면 헤더가 사라진다.
		await Post("/test/click", { Name: "group_External_default" });
		assert.equal(await Poll(`(() => document.querySelector('[data-testid="nav_${kProbeId}"]') !== null)()`, true), true);
	});

	void it("영역 헤더 우클릭으로 그룹을 만들면 바로 이름 편집이 열린다", async () =>
	{
		await OpenContextMenu("sidebar_header_external");
		const added = await Post("/test/click", { Name: "group_add_External" }) as { Ok?: boolean };
		assert.equal(added.Ok, true);
		assert.equal(await Poll("(() => document.querySelector('[data-testid=\"group_External_group-1__edit\"] input') !== null)()", true), true);
		const typed = await Eval("(() => { const input = document.querySelector('[data-testid=\"group_External_group-1__edit\"] input'); if (input === null) return false; input.value = '작업 그룹'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return true; })()");
		assert.equal(typed, true);
		assert.equal(await Poll("(() => document.querySelector('[data-testid=\"group_External_group-1\"] .gui-navheader__text')?.textContent ?? '')()", "작업 그룹"), "작업 그룹");
		const saved = GroupOf(await LiveGroups(), "group-1");
		assert.ok(saved !== null);
		assert.equal(saved.Name, "작업 그룹");
		assert.equal(saved.Collapsed, false);	// 확정 Enter가 헤더까지 올라가 접히면 안 된다.
	});

	void it("항목 우클릭 → 그룹으로 이동으로 다른 그룹에 넣는다", async () =>
	{
		await OpenContextMenu(`nav_${kProbeId}`);
		const opened = await Post("/test/click", { Name: `movegroup_${kProbeId}` }) as { Ok?: boolean };
		assert.equal(opened.Ok, true);
		await Wait(300);
		const picked = await Post("/test/click", { Name: `moveto_${kProbeId}_group-1` }) as { Ok?: boolean };
		assert.equal(picked.Ok, true);
		const moved = await Poll(`(() => { const list = [...document.querySelectorAll('[data-testid^="group_External_"],[data-testid^="nav_"]')].map((_el) => _el.getAttribute('data-testid')); const at = list.indexOf('nav_${kProbeId}'); return at > 0 && list[at - 1] === 'group_External_group-1'; })()`, true);
		assert.equal(moved, true);
		assert.deepEqual(GroupOf(await LiveGroups(), "group-1")?.Items, [kProbeId]);
		assert.equal(GroupOf(await LiveGroups(), "default")?.Items.includes(kProbeId), false);
	});

	void it("숨겨짐 그룹으로 옮기면 검색 결과에서 빠진다", async () =>
	{
		await OpenContextMenu(`nav_${kProbeId}`);
		await Post("/test/click", { Name: `movegroup_${kProbeId}` });
		await Wait(300);
		const picked = await Post("/test/click", { Name: `moveto_${kProbeId}_hidden` }) as { Ok?: boolean };
		assert.equal(picked.Ok, true);
		await Wait(300);
		assert.deepEqual(GroupOf(await LiveGroups(), "hidden")?.Items, [kProbeId]);
		await Post("/test/click", { Name: "group_External_hidden" });	// 펴서 항목이 보이는 상태로 만든다.
		assert.equal(await Poll(`(() => document.querySelector('[data-testid="nav_${kProbeId}"]') !== null)()`, true), true);
		await Filter("control");
		assert.equal(await Poll(`(() => document.querySelector('[data-testid="nav_${kProbeId}"]') !== null)()`, false), false);
		await Filter("notes");	// 숨겨짐이 아닌 그룹은 그대로 검색된다.
		assert.equal(await Poll("(() => document.querySelector('[data-testid=\"nav_Notes\"]') !== null)()", true), true);
		await Filter("");
		assert.equal(await Poll(`(() => document.querySelector('[data-testid="nav_${kProbeId}"]') !== null)()`, true), true);
	});

	void it("다른 그룹 헤더로 끌어다 놓으면 그 그룹으로 들어가고 버튼은 다시 만들지 않는다", async () =>
	{
		assert.equal(await Mark(`nav_${kProbeId}`), true);
		assert.equal(await Drag(`nav_${kProbeId}`, "group_External_group-1"), "is-drop-into");	// 헤더 드롭은 면 표시다.
		const moved = await Poll(`(() => { const list = [...document.querySelectorAll('[data-testid^="group_External_"],[data-testid^="nav_"]')].map((_el) => _el.getAttribute('data-testid')); const at = list.indexOf('nav_${kProbeId}'); return at > 0 && list[at - 1] === 'group_External_group-1'; })()`, true);
		assert.equal(moved, true);
		assert.equal(GroupOf(await LiveGroups(), "group-1")?.Items.includes(kProbeId), true);
		assert.equal(GroupOf(await LiveGroups(), "hidden")?.Items.includes(kProbeId), false);
		assert.equal(await Kept(`nav_${kProbeId}`), "1");	// reconcile이면 같은 버튼이 자리만 옮긴다.
		assert.equal(await Eval("(() => document.querySelector('.is-drop-into,.is-drop-before,.is-drop-after') === null)()"), true);
	});

	void it("영역을 넘는 드래그는 드롭 표시조차 뜨지 않는다", async () =>
	{
		assert.equal(await Eval("(() => document.querySelector('[data-testid=\"nav_ScouterCore\"]') !== null)()"), true);
		assert.equal(await Drag("nav_ScouterCore", "group_External_group-1"), "none");
		assert.equal(GroupOf(await LiveGroups(), "group-1")?.Items.includes("ScouterCore"), false);
		assert.equal(await Eval("(() => document.querySelector('.is-drop-into,.is-drop-before,.is-drop-after') === null)()"), true);
	});

	void it("다른 그룹의 항목 위로 끌면 선 표시가 뜨고 그 그룹으로 들어간다", async () =>
	{
		assert.equal(await Drag(`nav_${kProbeId}`, "nav_Notes"), "is-drop-before");	// 항목 드롭은 선 표시다.
		const back = await Poll(`(() => { const list = [...document.querySelectorAll('[data-testid^="nav_"]')].map((_el) => _el.getAttribute('data-testid')); return list.indexOf('nav_${kProbeId}') + 1 === list.indexOf('nav_Notes'); })()`, true);
		assert.equal(back, true);
		assert.equal(GroupOf(await LiveGroups(), "default")?.Items.includes(kProbeId), true);
		assert.equal(GroupOf(await LiveGroups(), "group-1")?.Items.includes(kProbeId), false);
	});
});
