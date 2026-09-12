/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UIManager Show·Dialog·Toast 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIManager, Window, MapLayoutProvider, RegisterWindow, ToastKind } from "@scouter/gui";

@RegisterWindow("Test/Shell")
class ShellWindow extends Window
{
}

@RegisterWindow("Test/Dialog")
class DialogWindow extends Window
{
}

function SetupRoot(): HTMLElement
{
	UIManager.Reset();
	const root = document.createElement("div");
	document.body.append(root);
	UIManager.Init(root, new MapLayoutProvider());
	return root;
}

void describe("UIManager", () =>
{
	void it("Show하면 Base 레이어 DOM에 붙는다", () =>
	{
		const dom = SetupRoot();
		const win = UIManager.Show("Test/Shell");
		assert.equal(win.IsLoaded, true);
		assert.equal(UIManager.Find("Test/Shell"), win);
		assert.equal(UIManager.Active, win);
		UIManager.Close(win);
		assert.equal(UIManager.Find("Test/Shell"), win);
		dom.remove();
		UIManager.Reset();
	});

	void it("ShowDialog는 값으로 풀린다", async () =>
	{
		SetupRoot();
		const pending = UIManager.ShowDialog<string>("Test/Dialog");
		const dialog = UIManager.Active;
		assert.notEqual(dialog, null);
		UIManager.Close(dialog as Window, "AllowOnce");
		assert.equal(await pending, "AllowOnce");
		UIManager.Reset();
	});

	void it("미등록 이름은 기본 Window로 열린다", () =>
	{
		const dom = SetupRoot();
		const win = UIManager.Show("Test/Static");
		assert.equal(win instanceof Window, true);
		UIManager.CloseAll();
		dom.remove();
		UIManager.Reset();
	});

	void it("Toast는 최대 5개까지 쌓인다", () =>
	{
		const dom = SetupRoot();
		for (let idx = 0; idx < 7; ++idx)
			UIManager.ShowToast({ Title: `t${idx}`, Variant: ToastKind.Info, DurationMs: 0 });
		assert.equal(dom.querySelectorAll(".gui-toast").length, 5);
		dom.remove();
		UIManager.Reset();
	});

	void it("ShellWindow 등록이 조회된다", () =>
	{
		assert.notEqual(ShellWindow, null);
		assert.notEqual(DialogWindow, null);
	});
});
