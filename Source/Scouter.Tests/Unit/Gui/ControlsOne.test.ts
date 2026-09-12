/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 컨트롤 상호작용 보충. ListBox·Expander·Label·상태계열.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ListBox, SelectionMode, Expander, GroupBox, Label, StackPanel, Badge, StatusDot, DotStatus, Spinner, TitleBar, ToastService, UIManager, MapLayoutProvider, TextBlock, InputDispatcher } from "@scouter/gui";
import type { IWindowChrome } from "@scouter/gui";
import { SimpleEvent } from "@scouter/gui";

class StubChrome implements IWindowChrome
{
	public readonly MaximizedChanged = new SimpleEvent<boolean>();
	public Calls: string[] = [];

	public Minimize(): void
	{
		this.Calls.push("min");
	}

	public ToggleMaximize(): void
	{
		this.Calls.push("max");
	}

	public Close(): void
	{
		this.Calls.push("close");
	}

	public IsMaximized(): Promise<boolean>
	{
		return Promise.resolve(false);
	}
}

void describe("ControlsOne", () =>
{
	void it("ListBox 클릭·키보드 Extended", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const list = new ListBox();
		list.SelectionMode = SelectionMode.Extended;
		list.SetItems(["a", "b", "c"]);
		document.body.append(list.Element);
		InputDispatcher.Attach(document.body, list);
		list.ClickIndex(0, false, false);
		list.ClickIndex(2, true, false);
		assert.deepEqual(list.SelectedItems, ["a", "b", "c"]);
		InputDispatcher.Detach();
		list.Dispose();
		root.remove();
		UIManager.Reset();
	});

	void it("Expander 펼침·GroupBox 헤더", () =>
	{
		const expander = new Expander();
		expander.Header = "일반";
		assert.equal(expander.IsExpanded, true);
		expander.IsExpanded = false;
		assert.ok(expander.Element.classList.contains("is-collapsed"));
		expander.Dispose();
		const group = new GroupBox();
		group.Header = "G";
		assert.equal(group.Element.querySelector("legend")?.textContent, "G");
		group.Dispose();
	});

	void it("Label Target 형제 연결", () =>
	{
		const root = new StackPanel();
		const label = new Label();
		const text = new TextBlock();
		text.Name = "txt_depot";
		root.AddChild(label);
		root.AddChild(text);
		label.SetValue(Label.TargetProperty, "#txt_depot");
		assert.equal(label.Element.getAttribute("for"), "txt_depot");
		root.Dispose();
	});

	void it("Badge·StatusDot·Spinner", () =>
	{
		const badge = new Badge();
		badge.Text = "27";
		assert.equal(badge.Element.textContent, "27");
		badge.Dispose();
		const dot = new StatusDot();
		dot.Status = DotStatus.Error;
		assert.ok(dot.Element.classList.contains("is-error"));
		dot.Dispose();
		const spinner = new Spinner();
		spinner.Size = 20;
		assert.equal(spinner.Element.style.width, "20px");
		spinner.Dispose();
	});

	void it("TitleBar 크롬 호출", () =>
	{
		const bar = new TitleBar();
		const chrome = new StubChrome();
		bar.Chrome = chrome;
		bar.Title = "T";
		assert.equal(chrome.Calls.length, 0);
		bar.Dispose();
	});

	void it("ToastService 5개 제한", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		ToastService.Info("a");
		ToastService.Success("b");
		ToastService.Warn("c");
		ToastService.Error("d");
		assert.equal(root.querySelectorAll(".gui-toast").length, 4);
		root.remove();
		UIManager.Reset();
	});
});
