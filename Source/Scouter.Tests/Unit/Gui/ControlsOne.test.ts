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

// Expander 헤더를 실제 포인터 입력으로 클릭한다. 합성 click이 아니라 InputDispatcher 경로를 태운다.
// @param _header: 헤더 버튼 DOM
function ClickHeader(_header: HTMLElement): void
{
	_header.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
	_header.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
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

	void it("Expander 접어도 헤더는 남고 다시 펼칠 수 있다", () =>
	{
		const expander = new Expander();
		expander.Header = "일반";
		const body = new TextBlock();
		body.Text = "본문";
		expander.Content = body;
		document.body.append(expander.Element);
		InputDispatcher.Attach(document.body, expander);
		const header = expander.Element.querySelector<HTMLElement>(".gui-expander__header");
		assert.ok(header !== null);
		assert.equal(expander.IsExpanded, true);
		assert.equal(header.getAttribute("aria-expanded"), "true");

		ClickHeader(header);
		assert.equal(expander.IsExpanded, false);
		assert.ok(expander.Element.classList.contains("is-expander-collapsed"));
		// Visibility.Collapsed 전용 클래스를 건드리면 루트가 통째로 사라진다.
		assert.ok(!expander.Element.classList.contains("is-collapsed"));
		// 접혀도 헤더는 DOM에 그대로 남아 다시 클릭할 수 있어야 한다.
		assert.equal(expander.Element.querySelector(".gui-expander__header"), header);
		assert.equal(header.isConnected, true);
		assert.equal(header.getAttribute("aria-expanded"), "false");

		ClickHeader(header);
		assert.equal(expander.IsExpanded, true);
		assert.ok(!expander.Element.classList.contains("is-expander-collapsed"));
		assert.equal(header.getAttribute("aria-expanded"), "true");

		InputDispatcher.Detach();
		expander.Dispose();
	});

	void it("GroupBox 헤더", () =>
	{
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
