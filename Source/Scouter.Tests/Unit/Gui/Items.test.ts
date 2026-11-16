/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SelectionModel·ListBox·ComboBox·Tab 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SelectionModel, ListBox, ListView, ComboBox, TabControl, TabItem, SelectionMode, UIManager, MapLayoutProvider, InputDispatcher } from "@scouter/gui";

void describe("Items", () =>
{
	void it("SelectionModel Replace/Toggle/Range", () =>
	{
		const model = new SelectionModel();
		assert.deepEqual(model.Replace([1, 2]).Added, [1, 2]);
		assert.equal(model.Anchor, 2);
		assert.deepEqual(model.Toggle(2).Removed, [2]);
		assert.deepEqual(model.Range(4).Added, [2, 3, 4]);
		assert.deepEqual(model.Indices, [2, 3, 4]);
	});

	void it("ListBox Extended Ctrl/Shift", () =>
	{
		const list = new ListBox();
		list.SelectionMode = SelectionMode.Extended;
		list.SetItems(["a", "b", "c", "d"]);
		list.ClickIndex(1, false, false);
		assert.equal(list.SelectedIndex, 1);
		list.ClickIndex(3, true, false);
		assert.deepEqual(list.SelectedItems, ["b", "c", "d"]);
		list.ClickIndex(0, false, true);
		assert.ok(list.SelectedItems.includes("a"));
		list.Dispose();
	});

	void it("ListBox 포인터는 DOM 순서로 굳힌다", () =>
	{
		const list = new ListBox();
		list.SetItems(["a0", "a1", "a2", "a3", "a4", "a5", "a6"]);
		const dom = document.createElement("div");
		document.body.append(dom);
		dom.append(list.Element);
		InputDispatcher.Attach(dom, list);
		try
		{
			const fifth = list.ContainerFromIndex(5);
			assert.notEqual(fifth, null);
			fifth?.Element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
			assert.equal(list.SelectedIndex, 5);
			list.Element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
			assert.equal(list.SelectedIndex, 5);
		}
		finally
		{
			InputDispatcher.Detach();
			list.Dispose();
			dom.remove();
		}
	});

	void it("ComboBox 닫힘 휠은 선택을 돌린다", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const combo = new ComboBox();
		combo.SetItems(["x", "y", "z"]);
		root.append(combo.Element);
		try
		{
			assert.equal(combo.SelectedIndex, -1);
			combo.Element.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));
			assert.equal(combo.SelectedIndex, 0);
			combo.Element.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));
			assert.equal(combo.SelectedIndex, 1);
			combo.Element.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
			assert.equal(combo.SelectedIndex, 0);
		}
		finally
		{
			combo.Dispose();
			root.remove();
			UIManager.Reset();
		}
	});

	void it("ComboBox 열림 휠은 선택을 바꾸지 않는다", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const combo = new ComboBox();
		combo.SetItems(["x", "y", "z"]);
		root.append(combo.Element);
		try
		{
			combo.SelectedIndex = 1;
			combo.IsDropDownOpen = true;
			const box = document.querySelector<HTMLElement>(".gui-popup .gui-listbox");
			assert.notEqual(box, null);
			assert.equal(box?.style.maxHeight, "300px");
			combo.Element.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));
			assert.equal(combo.SelectedIndex, 1);
			combo.IsDropDownOpen = false;
		}
		finally
		{
			combo.Dispose();
			root.remove();
			UIManager.Reset();
		}
	});

	void it("ComboBox 이미 선택된 항목을 다시 눌러도 목록이 닫힌다", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const combo = new ComboBox();
		combo.SetItems(["x", "y", "z"]);
		root.append(combo.Element);
		let changed = 0;
		combo.SelectionChanged.Add(() => { ++changed; });
		try
		{
			combo.SelectedIndex = 1;
			changed = 0;
			combo.IsDropDownOpen = true;
			const items = document.querySelectorAll<HTMLElement>(".gui-popup .gui-listbox__item");
			assert.equal(items.length, 3);
			items[1]?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
			assert.equal(combo.IsDropDownOpen, false);
			assert.equal(combo.SelectedIndex, 1);
			assert.equal(changed, 0);
			combo.IsDropDownOpen = true;
			const box = document.querySelector<HTMLElement>(".gui-popup .gui-listbox");
			box?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
			assert.equal(combo.IsDropDownOpen, true);
			document.querySelectorAll<HTMLElement>(".gui-popup .gui-listbox__item")[2]?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
			assert.equal(combo.IsDropDownOpen, false);
			assert.equal(combo.SelectedIndex, 2);
			assert.equal(changed, 1);
		}
		finally
		{
			combo.Dispose();
			root.remove();
			UIManager.Reset();
		}
	});

	void it("ListBox·ListView 선택 항목에 하이라이트(is-selected)가 붙고 항목을 다시 채워도 유지된다", () =>
	{
		const marked = (_root: HTMLElement): boolean[] => [..._root.querySelectorAll<HTMLElement>(".gui-listbox__item")].map((_e) => _e.classList.contains("is-selected"));
		const list = new ListBox();
		list.SetItems(["a", "b", "c"]);
		list.SelectedIndex = 2;
		assert.deepEqual(marked(list.Element), [false, false, true]);
		list.SelectedIndex = 0;
		assert.deepEqual(marked(list.Element), [true, false, false]);
		list.SetItems(["a", "b", "c", "d"]);
		assert.deepEqual(marked(list.Element), [true, false, false, false]);
		list.Dispose();
		const view = new ListView();
		view.SetItems([{ Name: "x" }, { Name: "y" }]);
		view.SelectedIndex = 1;
		assert.deepEqual(marked(view.Element), [false, true]);
		view.Dispose();
	});

	void it("ListView 행을 누르면 그 행이 선택된다(머리글이 순번을 밀지 않는다)", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const view = new ListView();
		view.SetItems([{ Name: "x" }, { Name: "y" }, { Name: "z" }]);
		root.append(view.Element);
		try
		{
			const rows = view.Element.querySelectorAll<HTMLElement>(".gui-listbox__item");
			rows[0]?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
			assert.equal(view.SelectedIndex, 0);
			rows[2]?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
			assert.equal(view.SelectedIndex, 2);
		}
		finally
		{
			view.Dispose();
			root.remove();
			UIManager.Reset();
		}
	});

	void it("ComboBox 목록을 열면 지금 선택된 항목이 선택 표시된다", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const combo = new ComboBox();
		combo.SetItems(["x", "y", "z"]);
		root.append(combo.Element);
		try
		{
			combo.SelectedIndex = 1;
			combo.IsDropDownOpen = true;
			const marked = [...document.querySelectorAll<HTMLElement>(".gui-popup .gui-listbox__item")].map((_e) => _e.classList.contains("is-selected"));
			assert.deepEqual(marked, [false, true, false]);
			combo.IsDropDownOpen = false;
			combo.SelectedIndex = 2;
			combo.IsDropDownOpen = true;
			const again = [...document.querySelectorAll<HTMLElement>(".gui-popup .gui-listbox__item")].map((_e) => _e.classList.contains("is-selected"));
			assert.deepEqual(again, [false, false, true]);
			combo.IsDropDownOpen = false;
		}
		finally
		{
			combo.Dispose();
			root.remove();
			UIManager.Reset();
		}
	});

	void it("ComboBox 본문에 항목이 붙지 않는다", () =>
	{
		const combo = new ComboBox();
		combo.SetItems(["oc-2", "tokyonight", "dracula"]);
		assert.equal(combo.Children.length, 1);
		assert.equal(combo.Element.textContent, "");
		combo.Dispose();
	});

	void it("ComboBox 열기·선택·닫기", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const combo = new ComboBox();
		combo.SetItems(["x", "y"]);
		document.body.append(combo.Element);
		combo.IsDropDownOpen = true;
		assert.equal(document.querySelectorAll(".gui-popup").length, 1);
		combo.IsDropDownOpen = false;
		assert.equal(document.querySelectorAll(".gui-popup").length, 0);
		combo.Dispose();
		root.remove();
		UIManager.Reset();
	});

	void it("TabControl hidden 토글", () =>
	{
		const tabs = new TabControl();
		const first = new TabItem();
		first.Header = "A";
		const second = new TabItem();
		second.Header = "B";
		tabs.SetItems([first, second]);
		assert.equal(tabs.SelectedIndex, 0);
		tabs.SelectedIndex = 1;
		assert.equal(second.Element.hasAttribute("hidden"), false);
		assert.equal(first.Element.hasAttribute("hidden"), true);
		tabs.Dispose();
	});

	void it("TabControl 직접 붙인 TabItem이 스트립에 오른다", () =>
	{
		const tabs = new TabControl();
		document.body.append(tabs.Element);
		const first = new TabItem();
		first.Header = "A";
		const second = new TabItem();
		second.Header = "B";
		tabs.AddChild(first);
		tabs.AddChild(second);
		try
		{
			assert.equal(tabs.Items.length, 2);
			assert.equal(tabs.SelectedIndex, 0);
			const heads = tabs.Element.querySelectorAll(".gui-tab");
			assert.equal(heads.length, 2);
			assert.equal(heads[0]?.textContent, "A");
			assert.equal(first.Element.hasAttribute("hidden"), false);
			assert.equal(second.Element.hasAttribute("hidden"), true);
			tabs.SelectedIndex = 1;
			assert.equal(second.Element.hasAttribute("hidden"), false);
			assert.equal(first.Element.hasAttribute("hidden"), true);
		}
		finally
		{
			tabs.Dispose();
		}
	});
});
