/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UIManager.Reload 성공·실패 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIManager, MapLayoutProvider } from "@scouter/gui";

void describe("Reload", () =>
{
	void it("XML 없으면 false", async () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const win = UIManager.Show("Test/ReloadEmpty");
		assert.equal(await UIManager.Reload(win), false);
		root.remove();
		UIManager.Reset();
	});

	void it("XML 있으면 true, 내용은 유지", async () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		const provider = new MapLayoutProvider();
		provider.Add("Test/ReloadOk", "<Window><Grid><StackPanel Name=\"ok_list\"/></Grid></Window>");
		UIManager.Init(root, provider);
		const win = UIManager.Show("Test/ReloadOk");
		assert.equal(await UIManager.Reload(win), true);
		assert.equal(win.IsLoaded, true);
		root.remove();
		UIManager.Reset();
	});
});
