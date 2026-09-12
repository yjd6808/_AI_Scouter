/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SelectionModel·ListBox·ComboBox·Tab 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SelectionModel, ListBox, ComboBox, TabControl, TabItem, SelectionMode, UIManager, MapLayoutProvider } from "@scouter/gui";

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
});
