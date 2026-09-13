/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UIManager Show·Dialog·Toast 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIManager, Window, MapLayoutProvider, RegisterWindow, ToastKind, UILayerKind } from "@scouter/gui";

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

	void it("닫으면 백드롭이 걷힌다", () =>
	{
		SetupRoot();
		const layer = UIManager.LayerElement(UILayerKind.Dialog) as HTMLElement;
		const pending = UIManager.ShowDialog<string>("Test/Dialog");
		void pending;
		assert.equal(layer.classList.contains("has-backdrop"), true);
		UIManager.Close(UIManager.Active as Window, "x");
		assert.equal(layer.classList.contains("has-backdrop"), false);
		UIManager.Reset();
	});

	void it("마지막 다이얼로그가 닫히면 Base inert가 풀린다", () =>
	{
		SetupRoot();
		const base = UIManager.LayerElement(UILayerKind.Base) as HTMLElement;
		const pending = UIManager.ShowDialog<string>("Test/Dialog");
		void pending;
		assert.equal(base.hasAttribute("inert"), true);
		UIManager.Close(UIManager.Active as Window, "x");
		assert.equal(base.hasAttribute("inert"), false);
		UIManager.Reset();
	});

	void it("같은 다이얼로그는 하나만 열린다", async () =>
	{
		SetupRoot();
		const layer = UIManager.LayerElement(UILayerKind.Dialog) as HTMLElement;
		const first = UIManager.ShowDialog<string>("Test/Dialog");
		const second = UIManager.ShowDialog<string>("Test/Dialog");
		assert.equal(layer.childElementCount, 1);
		UIManager.Close(UIManager.Active as Window, "AllowOnce");
		assert.equal(await first, "AllowOnce");
		assert.equal(await second, "AllowOnce");
		UIManager.Reset();
	});

	void it("로드 중 연타해도 다이얼로그는 하나만 열린다", async () =>
	{
		SetupRoot();
		const layer = UIManager.LayerElement(UILayerKind.Dialog) as HTMLElement;
		const first = UIManager.ShowDialogAsync<string>("Test/AsyncDialog");
		const second = UIManager.ShowDialogAsync<string>("Test/AsyncDialog");
		await new Promise((_resolve) => setTimeout(_resolve, 20));
		assert.equal(layer.childElementCount, 1);
		UIManager.Close(UIManager.Active as Window, "AllowOnce");
		assert.equal(await first, "AllowOnce");
		assert.equal(await second, "AllowOnce");
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
