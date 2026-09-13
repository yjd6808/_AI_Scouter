/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ToastLab Notify·Message 인자 검증 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotifyTool } from "../../../../Plugins/ToastLab/Tools/NotifyTool";
import { MessageTool } from "../../../../Plugins/ToastLab/Tools/MessageTool";
import type { TToastKind, TMessageKind, TMessageResult, TMessageScope } from "../../../../Plugins/ToastLab/Types";

void describe("ToastLab", () =>
{
	function SetupNotify(): { Tool: NotifyTool; Calls: Array<{ Kind: TToastKind; Title: string; Message: string; Global: boolean }> }
	{
		const calls: Array<{ Kind: TToastKind; Title: string; Message: string; Global: boolean }> = [];
		const tool = new NotifyTool((_kind, _title, _message, _global) =>
		{
			calls.push({ Kind: _kind, Title: _title, Message: _message, Global: _global });
		});
		return { Tool: tool, Calls: calls };
	}

	function SetupMessage(_result: TMessageResult = "ok"): { Tool: MessageTool; Calls: Array<{ Scope: TMessageScope; Title: string; Message: string; Kind: TMessageKind; DurationSec: number; Topmost: boolean }> }
	{
		const calls: Array<{ Scope: TMessageScope; Title: string; Message: string; Kind: TMessageKind; DurationSec: number; Topmost: boolean }> = [];
		const tool = new MessageTool((_scope, _title, _message, _kind, _durationSec, _topmost) =>
		{
			calls.push({ Scope: _scope, Title: _title, Message: _message, Kind: _kind, DurationSec: _durationSec, Topmost: _topmost });
			return Promise.resolve(_result);
		});
		return { Tool: tool, Calls: calls };
	}

	function Call(): { SessionId: string; Progress: () => undefined; Signal: AbortSignal; Log: () => undefined }
	{
		return { SessionId: "t", Progress: () => undefined, Signal: new AbortController().signal, Log: () => undefined };
	}

	void it("제목 없으면 throw", async () =>
	{
		const setup = SetupNotify();
		await assert.rejects(setup.Tool.Run({ Title: "  " }, Call()));
		await assert.rejects(setup.Tool.Run({}, Call()));
		assert.equal(setup.Calls.length, 0);
	});

	void it("종류·제목·내용을 싱크에 넘긴다", async () =>
	{
		const setup = SetupNotify();
		const out = await setup.Tool.Run({ Kind: "warn", Title: " hi ", Message: "body" }, Call()) as { Ok?: boolean; Kind?: string };
		assert.equal(out.Ok, true);
		assert.equal(out.Kind, "warn");
		assert.deepStrictEqual(setup.Calls, [{ Kind: "warn", Title: "hi", Message: "body", Global: false }]);
	});

	void it("Global이면 바탕화면까지 간다", async () =>
	{
		const setup = SetupNotify();
		const out = await setup.Tool.Run({ Title: "g", Global: true }, Call()) as { Ok?: boolean; Global?: boolean };
		assert.equal(out.Ok, true);
		assert.equal(out.Global, true);
		assert.deepStrictEqual(setup.Calls, [{ Kind: "info", Title: "g", Message: "", Global: true }]);
	});

	void it("이상한 종류는 info로 굳힌다", async () =>
	{
		const setup = SetupNotify();
		const out = await setup.Tool.Run({ Kind: "boom", Title: "t" }, Call()) as { Ok?: boolean; Kind?: string };
		assert.equal(out.Kind, "info");
		assert.deepStrictEqual(setup.Calls, [{ Kind: "info", Title: "t", Message: "", Global: false }]);
	});

	void it("Message 제목 없으면 throw", async () =>
	{
		const setup = SetupMessage();
		await assert.rejects(setup.Tool.Run({ Title: "  " }, Call()));
		await assert.rejects(setup.Tool.Run({}, Call()));
		assert.equal(setup.Calls.length, 0);
	});

	void it("Message 범위·종류·결과를 돌려준다", async () =>
	{
		const setup = SetupMessage("yes");
		const out = await setup.Tool.Run({ Scope: "Global", Title: " hi ", Message: "body", Kind: "yesno", DurationSec: 5, Topmost: true }, Call()) as { Ok?: boolean; Scope?: string; Kind?: string; Result?: string };
		assert.equal(out.Ok, true);
		assert.equal(out.Scope, "Global");
		assert.equal(out.Kind, "yesno");
		assert.equal(out.Result, "yes");
		assert.deepStrictEqual(setup.Calls, [{ Scope: "Global", Title: "hi", Message: "body", Kind: "yesno", DurationSec: 5, Topmost: true }]);
	});

	void it("Message 이상한 범위·종류는 기본값으로 굳힌다", async () =>
	{
		const setup = SetupMessage("closed");
		const out = await setup.Tool.Run({ Scope: "Moon", Title: "t", Kind: "maybe" }, Call()) as { Scope?: string; Kind?: string; Result?: string };
		assert.equal(out.Scope, "App");
		assert.equal(out.Kind, "ok");
		assert.equal(out.Result, "closed");
		assert.deepStrictEqual(setup.Calls, [{ Scope: "App", Title: "t", Message: "", Kind: "ok", DurationSec: 30, Topmost: false }]);
	});
});
