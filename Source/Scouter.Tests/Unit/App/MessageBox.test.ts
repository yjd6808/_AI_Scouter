/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: MessageBox 결과 굳히기·Global 무응답·App 타임아웃 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIManager, MapLayoutProvider } from "@scouter/gui";
import { MessageBox } from "../../../Scouter.App/Renderer/Services/MessageBox";
import { GlobalMessageBox } from "../../../Scouter.App/Renderer/Services/GlobalMessageBox";

void describe("MessageBox", () =>
{
	void it("버튼명은 그대로, 닫힘은 타임아웃과 나눈다", () =>
	{
		assert.equal(MessageBox.MapResult("ok", 0), "ok");
		assert.equal(MessageBox.MapResult("yes", 0), "yes");
		assert.equal(MessageBox.MapResult("no", 0), "no");
		assert.equal(MessageBox.MapResult(undefined, 0), "closed");
		assert.equal(MessageBox.MapResult(undefined, 1000), "timeout");
		assert.equal(MessageBox.MapResult("boom", 1000), "timeout");
		assert.equal(MessageBox.MapResult("boom", 0), "closed");
	});

	void it("Global은 Main 없으면 closed", async () =>
	{
		assert.equal(await GlobalMessageBox.ShowAsync({ Title: "x" }), "closed");
		assert.equal(await GlobalMessageBox.ShowAsync({ Title: "x", Kind: "yesno", DurationMs: 10 }), "closed");
	});

	void it("App 콜백과 Promise에 같은 결과를 준다", async () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		try
		{
			let seen = "";
			const result = await MessageBox.ShowAsync({
				Scope: "App", Title: "t", Message: "m", Kind: "ok", DurationMs: 30,
				OnResult: (_r) => { seen = _r; },
			});
			assert.equal(result, "timeout");
			assert.equal(seen, "timeout");
		}
		finally
		{
			root.remove();
			UIManager.Reset();
		}
	});
});
