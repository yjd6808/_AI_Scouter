/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UIManager.Reload 성공·실패 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIManager, MapLayoutProvider, Window, RegisterWindow, StackPanel, WindowRegistry } from "@scouter/gui";
import type { DataList } from "@scouter/gui";

let failNextInit = false;

@RegisterWindow("Test/ReloadInitFail")
class FailInitWindow extends Window
{
	protected override OnInit(_data: DataList): void
	{
		if (failNextInit)
			throw new Error("[FailInit] RequireName 실패: boom_box");
	}
}

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

	void it("Init이 터지면 false + 이전 내용으로 롤백", async () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		const provider = new MapLayoutProvider();
		provider.Add("Test/ReloadInitFail", "<Window><Grid><StackPanel Name=\"rb_list\"/></Grid></Window>");
		UIManager.Init(root, provider);
		assert.equal(WindowRegistry.Resolve("Test/ReloadInitFail"), FailInitWindow);
		failNextInit = false;
		const win = await UIManager.ShowAsync("Test/ReloadInitFail");
		failNextInit = true;
		assert.equal(await UIManager.Reload(win), false);
		assert.match(UIManager.LastReloadErrors[0] ?? "", /boom_box/);
		assert.notEqual(win.FindName(StackPanel, "rb_list"), null);
		failNextInit = false;
		assert.equal(await UIManager.Reload(win), true);
		root.remove();
		UIManager.Reset();
	});
});
