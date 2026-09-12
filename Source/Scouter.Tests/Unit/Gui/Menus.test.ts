/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Menu·ContextMenu·ToolBar·DataGrid 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Menu, MenuItem, ContextMenu, ToolBar, DataGrid, ListBox, KeyEventArgs, PointerEventArgs, ElementRegistry, Button } from "@scouter/gui";

function CheckItem(_header: string): MenuItem
{
	const item = new MenuItem();
	item.Header = _header;
	return item;
}

void describe("Menus", () =>
{
	void it("MenuItem 체커블 토글·Click", () =>
	{
		const item = CheckItem("저장");
		item.IsCheckable = true;
		let clicked = 0;
		item.Click.Add(() => { clicked++; });
		item.Activate();
		assert.equal(item.IsChecked, true);
		assert.equal(clicked, 1);
		item.Activate();
		assert.equal(item.IsChecked, false);
	});

	void it("Menu 헤더 실행·단일 오픈", () =>
	{
		const menu = new Menu();
		const leaf = CheckItem("실행");
		let ran = 0;
		leaf.Click.Add(() => { ran++; });
		const parent = CheckItem("파일");
		parent.AddItem(CheckItem("하위"));
		menu.AddItem(leaf);
		menu.AddItem(parent);
		assert.equal(menu.Element.querySelectorAll(".gui-menu__head").length, 2);
		leaf.Activate();
		assert.equal(ran, 1);
		const other = new ContextMenu();
		other.AddItem(CheckItem("x"));
		other.OpenAt(10, 10);
		assert.equal(other.IsOpen, true);
		menu.Open();
		assert.equal(other.IsOpen, false);
		assert.equal(menu.IsOpen, true);
		menu.Close();
	});

	void it("ContextMenu 우클릭으로 열린다", () =>
	{
		const list = new ListBox();
		const menu = new ContextMenu();
		menu.AddItem(CheckItem("경로 복사"));
		list.ContextMenu = menu;
		assert.equal(menu.IsOpen, false);
		list.ContextMenuOpening.Invoke(list, new PointerEventArgs(list, new PointerEvent("contextmenu", { clientX: 30, clientY: 40 })));
		assert.equal(menu.IsOpen, true);
		menu.Close();
		assert.equal(menu.IsOpen, false);
	});

	void it("ToolBar 넘침 없으면 버튼 없음", () =>
	{
		const bar = new ToolBar();
		bar.UpdateOverflow();
		assert.equal(bar.Element.querySelector(".gui-toolbar__overflow"), null);
	});

	void it("DataGrid 자동 열·정렬·정렬 끔", () =>
	{
		const grid = new DataGrid();
		grid.SetItems([{ Name: "b", Rev: 2 }, { Name: "a", Rev: 10 }]);
		assert.ok((grid.View?.Columns.map((_c) => _c.Header) ?? []).includes("Name"));
		const head = grid.Element.querySelector(".gui-gridview__headercell");
		assert.ok(head instanceof HTMLElement);
		head.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		const first = grid.Items[0] as Record<string, unknown>;
		assert.equal(first["Name"], "a");
		const locked = new DataGrid();
		locked.CanUserSortColumns = false;
		locked.SetItems([{ Name: "b" }, { Name: "a" }]);
		const head2 = locked.Element.querySelector(".gui-gridview__headercell");
		assert.ok(head2 instanceof HTMLElement);
		head2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.equal((locked.Items[0] as Record<string, unknown>)["Name"], "b");
	});

	void it("ToolBar » 키로 오버플로우가 열리고 닫힌다", () =>
	{
		const bar = new ToolBar();
		const action = new Button();
		bar.AddChild(action);
		Object.defineProperty(bar.Element, "scrollWidth", { value: 200, configurable: true });
		Object.defineProperty(bar.Element, "clientWidth", { value: 100, configurable: true });
		bar.UpdateOverflow();
		const all = bar.Element.querySelectorAll("button");
		const found = ElementRegistry.FromDom(all.item(all.length - 1));
		assert.ok(found instanceof Button);
		found.KeyDown.Invoke(found, new KeyEventArgs(found, new KeyboardEvent("keydown", { key: "Enter" })));
		assert.equal(bar.Children.length, 0);
	});
});
