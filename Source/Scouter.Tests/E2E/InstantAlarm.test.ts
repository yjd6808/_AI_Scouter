/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: InstantAlarm E2E. 오버레이 토글 → 2초 알람 발사 → 예약 취소 → List Tool 조회
	      → 컬럼명 헤더 정렬 → 행 선택·Delete 일원화.
	      발사는 실제 App 메시지 박스가 뜨므로 DefaultDurationSec=1로 두어 스스로 닫히게 한다.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

interface IFindResult
{
	TypeName?: string;
	Name?: string;
	Visible?: boolean;
	Enabled?: boolean;
	Rect?: { Width?: number; Height?: number };
}

interface IAlarmSummary
{
	Id?: string;
	Title?: string;
	State?: string;
	Result?: string;
	RemainingMs?: number;
}

interface IListResult
{
	Ok?: boolean;
	Counts?: { Armed?: number; Done?: number; Missed?: number; Canceled?: number };
	Armed?: IAlarmSummary[];
	Done?: IAlarmSummary[];
	Missed?: IAlarmSummary[];
	Canceled?: IAlarmSummary[];
}

// 목록 헤더·본문 행의 컬럼 x를 재어 온 결과.
interface IHeadShape
{
	HeadTexts?: string[];
	HistoryTexts?: string[];
	HeadLefts?: number[];
	RowLefts?: number[];
	HeadInsideList?: boolean;
}

// 행 클릭 직후의 선택 상태 스냅샷.
interface ISelectShape
{
	Found?: boolean;
	Selected?: boolean;
	SelectedCount?: number;
	Background?: string;
}

const kRequire = createRequire(import.meta.url);
const kElectronExe = kRequire("electron") as string;

const kPort = 9532;
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

function Sleep(_ms: number): Promise<void>
{
	return new Promise((_resolve) => setTimeout(_resolve, _ms));
}

async function CallTool(_name: string, _args: Record<string, unknown>): Promise<string>
{
	const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
	const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
	await client.connect(transport as unknown as Transport);
	try
	{
		const back = await client.callTool({ name: _name, arguments: _args });
		return (back.content as Array<{ text?: string }>)[0]?.text ?? "";
	}
	finally
	{
		await client.close();
	}
}

async function ReadList(): Promise<IListResult>
{
	return JSON.parse(await CallTool("InstantAlarm__List", {})) as IListResult;
}

// 목록 행은 코드로 만들어 Name이 없다. /test/click을 못 쓰므로 렌더러에서 직접 재고 두드린다.
async function Eval<T>(_script: string): Promise<T>
{
	const back = await Post("/test/eval", { Script: _script }) as { Ok?: boolean; Value?: T; Error?: string };
	if (back.Ok !== true)
		throw new Error(`[E2E] eval 실패: ${back.Error ?? ""}`);
	return back.Value as T;
}

// 예약 목록에 제목이 _mark인 행이 그려질 때까지 기다린다. 화면 갱신은 1초 공용 틱이라 즉시 뜨지 않는다.
// 취소·완료 기록도 [전체] 필터에서는 같은 목록에 남으므로 행 개수만 세면 옛 행에 속는다.
async function WaitRow(_mark: string): Promise<boolean>
{
	const script = `[...document.querySelectorAll('[data-testid="lst_armed"] .instantalarm-row')].some((_r) => (_r.textContent ?? '').includes(${JSON.stringify(_mark)}))`;
	for (let idx = 0; idx < 40; ++idx)
	{
		if (await Eval<boolean>(script))
			return true;
		await Sleep(250);
	}
	return false;
}

void describe("InstantAlarm E2E", () =>
{
	before(async () =>
	{
		child = spawn(kElectronExe, ["dist/main/Main.cjs", "--test", "--hidden", "--no-auth", "--port", String(kPort), "--plugin-dir", "Plugins"], { stdio: "ignore" });
		await WaitReady();
		await Post("/test/approval", { Policy: "allow" });
		// 발사한 메시지 박스가 스스로 닫히게 한다. 예약 시점의 설정이 스펙에 굳는다.
		await Post("/test/settings", { Path: "Plugins.InstantAlarm.DefaultDurationSec", Value: 1 });
		await Post("/test/click", { Name: "nav_InstantAlarm" });
		await Sleep(600);
	});

	after(() =>
	{
		child?.kill();
		child = null;
	});

	void it("Tool 6종이 전부 노출된다", async () =>
	{
		const client = new Client({ name: "e2e", version: "0.0.1" }, { capabilities: {} });
		const transport = new StreamableHTTPClientTransport(new URL(`${kBase}/mcp`));
		await client.connect(transport as unknown as Transport);
		try
		{
			const listed = await client.listTools();
			const names = listed.tools.map((_t) => _t.name);
			for (const tool of ["ArmAfter", "ArmAt", "List", "ArmGroup", "Cancel", "SaveGroup"])
				assert.ok(names.includes(`InstantAlarm__${tool}`), tool);
		}
		finally
		{
			await client.close();
		}
	});

	void it("+ 버튼을 누르면 오버레이가 뜨고 본문이 잠긴다", async () =>
	{
		const before = await Get("/test/find?name=ovl_add") as IFindResult;
		assert.equal(before.Visible, false);
		await Post("/test/click", { Name: "btn_add" });
		await Sleep(300);
		const opened = await Get("/test/find?name=ovl_add") as IFindResult;
		assert.equal(opened.Visible, true);
		assert.ok((opened.Rect?.Height ?? 0) > 100);
		// 딤이 실제로 칠해져야 포인터가 뒤로 통과하지 않는다.
		const painted = await Post("/test/eval", {
			Script: "(() => { const el = document.querySelector('[data-testid=\"ovl_add\"]'); if (el === null) return 'none'; return getComputedStyle(el).backgroundColor; })()",
		}) as { Value?: string };
		assert.notEqual(painted.Value, "rgba(0, 0, 0, 0)");
		assert.notEqual(painted.Value, "none");
		// 본문은 inert가 걸려 오버레이 뒤 버튼이 눌리지 않는다.
		const body = await Get("/test/find?name=pnl_body") as IFindResult;
		assert.equal(body.Enabled, false);
		await Post("/test/click", { Name: "btn_add_close" });
		await Sleep(300);
		const closed = await Get("/test/find?name=ovl_add") as IFindResult;
		assert.equal(closed.Visible, false);
	});

	void it("2초 뒤 알람을 예약하면 스스로 울리고 완료로 남는다", async () =>
	{
		const mark = `e2e-fire-${Date.now()}`;
		const armed = JSON.parse(await CallTool("InstantAlarm__ArmAfter", { Seconds: 2, Title: mark })) as { Ok?: boolean; Alarm?: IAlarmSummary };
		assert.equal(armed.Ok, true);
		const id = armed.Alarm?.Id ?? "";
		assert.ok(id.length > 0);
		const pending = await ReadList();
		assert.ok((pending.Armed ?? []).some((_a) => _a.Id === id));
		await Sleep(5000);
		const after = await ReadList();
		const done = (after.Done ?? []).find((_a) => _a.Id === id);
		assert.ok(done !== undefined, "발사 후 Done 목록에 있어야 한다");
		assert.equal(done.Title, mark);
		assert.equal(done.Result, "timeout");
		assert.ok(!(after.Armed ?? []).some((_a) => _a.Id === id));
	});

	void it("예약을 취소하면 목록에서 빠진다", async () =>
	{
		const mark = `e2e-cancel-${Date.now()}`;
		const armed = JSON.parse(await CallTool("InstantAlarm__ArmAfter", { Seconds: 600, Title: mark })) as { Alarm?: IAlarmSummary };
		const id = armed.Alarm?.Id ?? "";
		assert.ok(id.length > 0);
		const back = JSON.parse(await CallTool("InstantAlarm__Cancel", { Id: id })) as { Ok?: boolean; Canceled?: number };
		assert.equal(back.Ok, true);
		assert.equal(back.Canceled, 1);
		const after = await ReadList();
		assert.ok(!(after.Armed ?? []).some((_a) => _a.Id === id));
		assert.ok((after.Canceled ?? []).some((_a) => _a.Id === id));
	});

	void it("List Tool이 상태별 목록과 남은 시간을 돌려준다", async () =>
	{
		const mark = `e2e-list-${Date.now()}`;
		await CallTool("InstantAlarm__ArmAfter", { Seconds: 3600, Title: mark, Message: "본문" });
		const listed = await ReadList();
		assert.equal(listed.Ok, true);
		const found = (listed.Armed ?? []).find((_a) => _a.Title === mark);
		assert.ok(found !== undefined);
		assert.equal(found.State, "Armed");
		assert.ok((found.RemainingMs ?? 0) > 3500000);
		assert.ok((listed.Counts?.Armed ?? 0) >= 1);
		await CallTool("InstantAlarm__Cancel", { All: true });
	});

	void it("그룹을 저장하고 통째로 예약한다", async () =>
	{
		const group = `e2e-group-${Date.now()}`;
		const saved = JSON.parse(await CallTool("InstantAlarm__SaveGroup", {
			Name: group,
			Specs: [{ Title: "첫 알람", Seconds: 1800 }, { Title: "둘째 알람", Seconds: 3600 }],
		})) as { Ok?: boolean; Count?: number };
		assert.equal(saved.Ok, true);
		assert.equal(saved.Count, 2);
		const armed = JSON.parse(await CallTool("InstantAlarm__ArmGroup", { GroupName: group })) as { Ok?: boolean; Armed?: IAlarmSummary[] };
		assert.equal(armed.Ok, true);
		assert.equal((armed.Armed ?? []).length, 2);
		await CallTool("InstantAlarm__Cancel", { All: true });
	});

	void it("목록 맨 위 컬럼명 헤더가 본문 행과 같은 x에서 시작한다", async () =>
	{
		const mark = `e2e-head-${Date.now()}`;
		await CallTool("InstantAlarm__ArmAfter", { Seconds: 3600, Title: mark });
		assert.ok(await WaitRow(mark), "예약 목록에 행이 그려져야 한다");
		const script = `(() => {
			const head = document.querySelector('[data-testid="pnl_armed_head"]');
			const history = document.querySelector('[data-testid="pnl_history_head"]');
			const list = document.querySelector('[data-testid="lst_armed"]');
			const row = list === null ? null : list.querySelector('.instantalarm-row');
			const lefts = (_el) => _el === null ? [] : [..._el.children].slice(0, 5).map((_c) => Math.round(_c.getBoundingClientRect().left));
			const texts = (_el) => _el === null ? [] : [..._el.children].map((_c) => _c.textContent ?? '');
			return {
				HeadTexts: texts(head),
				HistoryTexts: texts(history),
				HeadLefts: lefts(head),
				RowLefts: lefts(row),
				HeadInsideList: head !== null && list !== null && list.contains(head),
			};
		})()`;
		const shape = await Eval<IHeadShape>(script);
		assert.deepStrictEqual(shape.HeadTexts, ["", "시각", "제목", "상태", "남은 시간", "동작"]);
		assert.deepStrictEqual(shape.HistoryTexts, ["", "시각", "제목", "결과", "경과", "동작"]);
		// 헤더 칸과 본문 칸의 왼쪽 x가 전부 같아야 컬럼이 맞는다. 폭 상수를 두 벌 적으면 여기서 깨진다.
		assert.equal((shape.HeadLefts ?? []).length, 5);
		assert.deepStrictEqual(shape.HeadLefts, shape.RowLefts);
		// 헤더가 VirtualList 안에 있으면 스크롤에 밀려 올라간다.
		assert.equal(shape.HeadInsideList, false);
		await CallTool("InstantAlarm__Cancel", { All: true });
	});

	void it("행을 클릭하면 선택 표시가 붙고 같은 선택을 도구 모음이 그대로 쓴다", async () =>
	{
		const mark = `e2e-select-${Date.now()}`;
		const armed = JSON.parse(await CallTool("InstantAlarm__ArmAfter", { Seconds: 1800, Title: mark })) as { Alarm?: IAlarmSummary };
		const id = armed.Alarm?.Id ?? "";
		assert.ok(id.length > 0);
		assert.ok(await WaitRow(mark), "예약 목록에 행이 그려져야 한다");
		const script = `(() => {
			const list = document.querySelector('[data-testid="lst_armed"]');
			if (list === null)
				return { Found: false };
			const row = [...list.querySelectorAll('.instantalarm-row')].find((_r) => (_r.textContent ?? '').includes(${JSON.stringify(mark)}));
			if (row === undefined)
				return { Found: false };
			row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
			return {
				Found: true,
				Selected: row.classList.contains('is-selected'),
				SelectedCount: list.querySelectorAll('.instantalarm-row.is-selected').length,
				Background: getComputedStyle(row).backgroundColor,
			};
		})()`;
		const picked = await Eval<ISelectShape>(script);
		assert.equal(picked.Found, true);
		assert.equal(picked.Selected, true, "클릭한 행에 선택 클래스가 붙어야 한다");
		assert.equal(picked.SelectedCount, 1, "선택은 한 번에 1건이다");
		// 선택 색이 실제로 칠해져야 한다. 없는 테마 토큰을 쓰면 조용히 투명으로 넘어간다.
		assert.notEqual(picked.Background, "rgba(0, 0, 0, 0)");
		// [선택 취소]·Delete 키·우클릭 메뉴는 모두 같은 selectedAlarmId_를 본다.
		// 클릭으로 고른 행이 그대로 취소되면 화면 표시와 그 상태가 하나로 묶여 있다는 뜻이다.
		await Post("/test/click", { Name: "btn_cancel_sel" });
		await Sleep(500);
		const after = await ReadList();
		assert.ok(!(after.Armed ?? []).some((_a) => _a.Id === id), "클릭으로 고른 예약이 취소돼야 한다");
		assert.ok((after.Canceled ?? []).some((_a) => _a.Id === id));
		await CallTool("InstantAlarm__Cancel", { All: true });
	});
});
