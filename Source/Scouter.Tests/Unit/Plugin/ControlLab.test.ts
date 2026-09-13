/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ControlLab 저장소·Tool 인자 검증 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ControlStore } from "../../../../Plugins/ControlLab/ControlStore";
import { LogTool } from "../../../../Plugins/ControlLab/Tools/LogTool";
import { StateTool } from "../../../../Plugins/ControlLab/Tools/StateTool";

void describe("ControlLab", () =>
{
	function Call(): { SessionId: string; Progress: () => undefined; Signal: AbortSignal; Log: () => undefined }
	{
		return { SessionId: "t", Progress: () => undefined, Signal: new AbortController().signal, Log: () => undefined };
	}

	void it("200개 넘으면 앞에서 버린다", () =>
	{
		const store = new ControlStore();
		for (let idx = 0; idx < 205; ++idx)
			store.Log("info", `n${idx}`, "");
		assert.equal(store.Count(), 200);
		assert.equal(store.All()[0]?.Name, "n5");
		store.Clear();
		assert.equal(store.Count(), 0);
	});

	void it("이름 없으면 throw", async () =>
	{
		const store = new ControlStore();
		const tool = new LogTool(store);
		await assert.rejects(tool.Run({ Name: "  " }, Call()));
		await assert.rejects(tool.Run({}, Call()));
		assert.equal(store.Count(), 0);
	});

	void it("기록하고 개수를 돌려준다", async () =>
	{
		const store = new ControlStore();
		const tool = new LogTool(store);
		const out = await tool.Run({ Kind: "warn", Name: " btn ", Detail: "d" }, Call()) as { Ok?: boolean; Kind?: string; Count?: number };
		assert.equal(out.Ok, true);
		assert.equal(out.Kind, "warn");
		assert.equal(out.Count, 1);
		assert.equal(store.All()[0]?.Name, "btn");
	});

	void it("이상한 종류는 info로 굳힌다", async () =>
	{
		const store = new ControlStore();
		const tool = new LogTool(store);
		const out = await tool.Run({ Kind: "boom", Name: "x" }, Call()) as { Kind?: string };
		assert.equal(out.Kind, "info");
	});

	void it("상태는 개수와 최근 순을 돌려준다", async () =>
	{
		const store = new ControlStore();
		store.Log("info", "a", "");
		store.Log("error", "b", "boom");
		const tool = new StateTool(store);
		const out = await tool.Run({ Limit: 1 }, Call()) as { Ok: boolean; Count: number; Events: Array<{ Name: string }> };
		assert.equal(out.Ok, true);
		assert.equal(out.Count, 2);
		assert.equal(out.Events.length, 1);
		const first = out.Events[0];
		assert.ok(first !== undefined);
		assert.equal(first.Name, "b");
		const capped = await tool.Run({ Limit: 999 }, Call()) as { Events: unknown[] };
		assert.equal(capped.Events.length, 2);
	});
});
