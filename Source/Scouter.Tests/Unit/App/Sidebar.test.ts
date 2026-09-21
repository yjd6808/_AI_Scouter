/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: SidebarController 항목·구분색·선택·그룹 테스트. diff 동기화라 같은 입력이면 자식이 그대로여야 한다.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StackPanel, ToggleButton, IconSprite } from "@scouter/gui";
import type { ShellWindow } from "../../../Scouter.App/Renderer/Shell/ShellWindow";
import { SidebarController } from "../../../Scouter.App/Renderer/Shell/SidebarController";
import type { ISidebarItem } from "../../../Scouter.App/Renderer/Shell/SidebarController";
import type { SidebarGroupHeader } from "../../../Scouter.App/Renderer/Shell/SidebarGroupHeader";
import { PluginGroups } from "../../../Scouter.App/Renderer/Plugin/PluginGroups";
import type { IPluginGroupState, TPluginGroupArea } from "../../../Scouter.App/Renderer/Plugin/PluginGroups";

function Setup(): { Controller: SidebarController; List: StackPanel }
{
	const list = new StackPanel();
	const shell = { Navigate: (_id: string): void => undefined } as unknown as ShellWindow;
	return { Controller: new SidebarController(list, shell), List: list };
}

function Item(_id: string, _title: string, _external: boolean): ISidebarItem
{
	return { Id: _id, Title: _title, Icon: "package", Source: _external ? "External" : "BuiltIn", State: "Active" };
}

function IconOf(_controller: SidebarController, _id: string): string
{
	const found = _controller.Find(_id);
	assert.ok(found instanceof ToggleButton, _id);
	return found.Icon;
}

function HeaderKeys(_list: StackPanel): string[]
{
	return [..._list.Element.children].map((_el) => _el.getAttribute("data-testid") ?? "");
}

function Toggle(_element: Element): void
{
	_element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));	// 헤더는 눌렀다 뗀 경우에만 접힌다. 드롭 pointerup을 먹지 않기 위해서다.
	_element.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true, button: 0 }));
}

function PressKey(_element: Element, _key: string): void
{
	_element.dispatchEvent(new KeyboardEvent("keydown", { key: _key, bubbles: true, cancelable: true }));
}

function GroupOf(_state: IPluginGroupState, _area: TPluginGroupArea, _groupId: string): string[]
{
	return PluginGroups.FindGroup(_state, _area, _groupId)?.Items ?? [];
}

function Header(_controller: SidebarController, _area: TPluginGroupArea, _groupId: string): SidebarGroupHeader
{
	const found = _controller.FindHeader(_area, _groupId);
	assert.ok(found !== null);
	return found;
}

function EditorOf(_header: SidebarGroupHeader): HTMLInputElement
{
	const input = _header.Element.querySelector("input");
	assert.ok(input !== null);
	return input;
}

function TypeInto(_input: HTMLInputElement, _text: string): void
{
	_input.value = _text;
	_input.dispatchEvent(new Event("input", { bubbles: true }));
}

void describe("Sidebar", () =>
{
	void it("내장은 is-core, 외부는 is-external", () =>
	{
		const setup = Setup();
		const items: ISidebarItem[] = [
			{ Id: "Notes", Title: "Notes", Icon: "package", Source: "External", State: "Active" },
			{ Id: "ScouterCore", Title: "Scouter Core", Icon: "package", Source: "BuiltIn", State: "Active" },
		];
		setup.Controller.Sync(items);
		assert.equal(setup.Controller.Find("ScouterCore")?.Element.classList.contains("is-core"), true);
		assert.equal(setup.Controller.Find("ScouterCore")?.Element.classList.contains("is-external"), false);
		assert.equal(setup.Controller.Find("Notes")?.Element.classList.contains("is-external"), true);
		assert.equal(setup.Controller.Find("Notes")?.Element.classList.contains("is-core"), false);
	});

	void it("선택은 하나만 남는다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([
			{ Id: "A", Title: "A", Icon: "package", Source: "BuiltIn", State: "Active" },
			{ Id: "B", Title: "B", Icon: "package", Source: "External", State: "Active" },
		]);
		setup.Controller.Select("B");
		assert.equal((setup.Controller.Find("B") as ToggleButton).IsChecked, true);
		assert.equal((setup.Controller.Find("A") as ToggleButton).IsChecked, false);
	});

	void it("필터는 제목·Id 부분 일치만 남긴다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([
			{ Id: "ScouterCore", Title: "Scouter Core", Icon: "package", Source: "BuiltIn", State: "Active" },
			{ Id: "Notes", Title: "Notes", Icon: "package", Source: "External", State: "Active" },
			{ Id: "P4Util", Title: "Perforce Utilities", Icon: "package", Source: "External", State: "Active" },
		]);
		setup.Controller.Filter("core");
		assert.notEqual(setup.Controller.Find("ScouterCore"), null);
		assert.equal(setup.Controller.Find("Notes"), null);
		setup.Controller.Filter("util");
		assert.notEqual(setup.Controller.Find("P4Util"), null);
		assert.equal(setup.Controller.Find("ScouterCore"), null);
		setup.Controller.Filter("");
		assert.notEqual(setup.Controller.Find("Notes"), null);
	});

	void it("시스템·외부 영역 헤더가 나뉜다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([
			{ Id: "ScouterCore", Title: "Scouter Core", Icon: "package", Source: "BuiltIn", State: "Active" },
			{ Id: "Notes", Title: "Notes", Icon: "package", Source: "External", State: "Active" },
		]);
		const root = setup.List.Element;
		assert.notEqual(root.querySelector("[data-testid=\"sidebar_header_system\"]"), null);
		assert.notEqual(root.querySelector("[data-testid=\"sidebar_header_external\"]"), null);
	});

	void it("드래그 순서 변경은 영역·항목·그룹·위치를 콜백으로 넘긴다", () =>
	{
		const setup = Setup();
		let saved: unknown[] = [];
		setup.Controller.Sync([
			{ Id: "A", Title: "A", Icon: "package", Source: "External", State: "Active" },
			{ Id: "B", Title: "B", Icon: "package", Source: "External", State: "Active" },
			{ Id: "C", Title: "C", Icon: "package", Source: "External", State: "Active" },
		], { SortMode: "Custom", OnOrderChanged: (_area, _itemId, _groupId, _index) => { saved = [_area, _itemId, _groupId, _index]; } });
		assert.equal(setup.Controller.MoveBefore("C", "A", false), true);
		assert.deepEqual(setup.Controller.ExternalIds(), ["C", "A", "B"]);
		assert.deepEqual(saved, ["External", "C", "default", 0]);
	});

	void it("시스템 항목은 드래그 대상이 아니다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([
			{ Id: "ScouterCore", Title: "Scouter Core", Icon: "package", Source: "BuiltIn", State: "Active" },
			{ Id: "Notes", Title: "Notes", Icon: "package", Source: "External", State: "Active" },
		], { SortMode: "Custom", OnOrderChanged: () => undefined });
		assert.equal(setup.Controller.MoveBefore("ScouterCore", "Notes", false), false);
		assert.equal(setup.Controller.MoveBefore("Notes", "ScouterCore", false), false);
	});

	void it("정렬기준 모드에서는 드래그 손잡이를 달지 않는다", () =>
	{
		const setup = Setup();
		const items: ISidebarItem[] = [
			{ Id: "Notes", Title: "Notes", Icon: "package", Source: "External", State: "Active" },
		];
		setup.Controller.Sync(items, { SortMode: "MostClicked", OnOrderChanged: () => undefined });
		assert.notEqual(setup.Controller.Find("Notes")?.Element.style.cursor, "grab");
		setup.Controller.Sync(items, { SortMode: "Custom", OnOrderChanged: () => undefined });
		assert.equal(setup.Controller.Find("Notes")?.Element.style.cursor, "grab");
	});

	void it("같은 입력으로 다시 동기화하면 자식이 하나도 바뀌지 않는다", () =>
	{
		const setup = Setup();
		const items = [Item("ScouterCore", "Scouter Core", false), Item("Notes", "Notes", true), Item("P4Util", "Perforce", true)];
		setup.Controller.Sync(items);
		const before = [...setup.List.Children];
		const beforeDom = [...setup.List.Element.children];
		setup.Controller.Sync(items.map((_item) => ({ ..._item })));
		const after = [...setup.List.Children];
		const afterDom = [...setup.List.Element.children];
		assert.equal(before.length, 9);	// 영역 2 + 그룹 4 + 항목 3
		assert.equal(after.length, before.length);
		assert.equal(afterDom.length, beforeDom.length);
		for (let idx = 0; idx < before.length; ++idx)
		{
			assert.equal(after[idx], before[idx]);
			assert.equal(afterDom[idx], beforeDom[idx]);
		}
	});

	void it("헤더도 다시 만들지 않는다", () =>
	{
		const setup = Setup();
		const items = [Item("ScouterCore", "Scouter Core", false), Item("Notes", "Notes", true)];
		setup.Controller.Sync(items);
		const header = setup.List.Element.querySelector("[data-testid=\"sidebar_header_system\"]");
		const group = setup.List.Element.querySelector("[data-testid=\"group_External_default\"]");
		assert.notEqual(header, null);
		assert.notEqual(group, null);
		setup.Controller.Sync(items);
		assert.equal(setup.List.Element.querySelector("[data-testid=\"sidebar_header_system\"]"), header);
		assert.equal(setup.List.Element.querySelector("[data-testid=\"group_External_default\"]"), group);
	});

	void it("사라진 항목만 정리하고 남은 버튼은 같은 인스턴스다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("A", "A", true), Item("B", "B", true), Item("C", "C", true)]);
		const kept = setup.Controller.Find("A");
		const gone = setup.Controller.Find("B");
		assert.notEqual(kept, null);
		setup.Controller.Sync([Item("A", "A", true), Item("C", "C", true)]);
		assert.equal(setup.Controller.Find("A"), kept);
		assert.equal(setup.Controller.Find("B"), null);
		assert.equal(gone?.Parent, null);
	});

	void it("순서만 바뀌면 같은 인스턴스가 자리를 옮긴다", () =>
	{
		const setup = Setup();
		const items = [Item("A", "A", true), Item("B", "B", true), Item("C", "C", true)];
		setup.Controller.Sync(items);
		const a = setup.Controller.Find("A");
		const c = setup.Controller.Find("C");
		const moved = PluginGroups.MoveItem(setup.Controller.Groups(), "External", "C", "default", 0);
		setup.Controller.Sync(items, { Groups: moved });
		assert.equal(setup.Controller.Find("A"), a);
		assert.equal(setup.Controller.Find("C"), c);
		assert.equal(setup.List.Children[2], c);
		assert.equal(setup.List.Children[3], a);
	});

	void it("제목이 바뀌면 같은 버튼의 내용만 갱신한다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("Notes", "Notes", true)]);
		const btn = setup.Controller.Find("Notes") as ToggleButton;
		setup.Controller.Sync([Item("Notes", "메모장", true)]);
		assert.equal(setup.Controller.Find("Notes"), btn);
		assert.equal(btn.Content, "메모장");
		assert.equal(btn.ToolTip, "메모장");
	});

	void it("필터를 걸었다 풀어도 남아 있던 항목은 같은 인스턴스다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("ScouterCore", "Scouter Core", false), Item("Notes", "Notes", true)]);
		const core = setup.Controller.Find("ScouterCore");
		setup.Controller.Filter("core");
		assert.equal(setup.Controller.Find("ScouterCore"), core);
		assert.equal(setup.Controller.Find("Notes"), null);
		setup.Controller.Filter("");
		assert.equal(setup.Controller.Find("ScouterCore"), core);
		assert.notEqual(setup.Controller.Find("Notes"), null);
	});

	void it("다시 동기화해도 포커스가 버튼에 남는다", () =>
	{
		const setup = Setup();
		document.body.append(setup.List.Element);
		try
		{
			const items = [Item("A", "A", true), Item("B", "B", true)];
			setup.Controller.Sync(items);
			assert.equal(setup.Controller.Focus("B"), true);
			const focused = setup.Controller.Find("B")?.Element;
			assert.equal(document.activeElement, focused);
			setup.Controller.Sync(items.map((_item) => ({ ..._item })));
			assert.equal(setup.Controller.Find("B")?.Element, focused);
			assert.equal(document.activeElement, focused);
		}
		finally
		{
			setup.List.Element.remove();
		}
	});

	void it("상태가 Error로 바뀌면 같은 버튼에 is-error만 붙는다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("Notes", "Notes", true)]);
		const btn = setup.Controller.Find("Notes") as ToggleButton;
		assert.equal(btn.Element.classList.contains("is-error"), false);
		setup.Controller.Sync([{ Id: "Notes", Title: "Notes", Icon: "package", Source: "External", State: "Error" }]);
		assert.equal(setup.Controller.Find("Notes"), btn);
		assert.equal(btn.Element.classList.contains("is-error"), true);
	});

	// ==================== 그룹 ====================

	void it("영역 → 그룹 → 항목 순으로 그리고 그룹 키에 영역을 접두로 붙인다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("ScouterCore", "Scouter Core", false), Item("Notes", "Notes", true)]);
		assert.deepEqual(HeaderKeys(setup.List), [
			"sidebar_header_system", "group_System_default", "nav_ScouterCore", "group_System_hidden",
			"sidebar_header_external", "group_External_default", "nav_Notes", "group_External_hidden",
		]);
	});

	void it("항목은 그룹보다 한 단계 더 들여쓴다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("Notes", "Notes", true)]);
		assert.equal(Header(setup.Controller, "External", "").Element.style.getPropertyValue("--gui-nav-depth"), "0");
		assert.equal(Header(setup.Controller, "External", "default").Element.style.getPropertyValue("--gui-nav-depth"), "1");
		assert.equal(setup.Controller.Find("Notes")?.Element.style.getPropertyValue("--gui-nav-depth"), "2");
	});

	void it("그룹 헤더를 누르면 접히고 항목이 사라진다", () =>
	{
		const setup = Setup();
		let saved: IPluginGroupState | null = null;
		setup.Controller.Sync([Item("Notes", "Notes", true)], { OnGroupsChanged: (_state) => { saved = _state; } });
		const header = Header(setup.Controller, "External", "default");
		Toggle(header.Element);
		assert.equal(setup.Controller.Find("Notes"), null);
		assert.equal(header.IsCollapsed, true);
		assert.equal(header.Element.classList.contains("is-folded"), true);
		assert.equal(header.Element.classList.contains("is-collapsed"), false);	// 프레임워크 Visibility 클래스라 겹치면 헤더가 통째로 사라진다.
		assert.equal(PluginGroups.FindGroup(saved as unknown as IPluginGroupState, "External", "default")?.Collapsed, true);
		Toggle(header.Element);
		assert.notEqual(setup.Controller.Find("Notes"), null);
	});

	void it("영역 헤더를 누르면 영역이 통째로 접힌다", () =>
	{
		const setup = Setup();
		let saved: [string, boolean] | null = null;
		setup.Controller.Sync([Item("Notes", "Notes", true)], { OnAreaCollapsedChanged: (_area, _collapsed) => { saved = [_area, _collapsed]; } });
		Toggle(Header(setup.Controller, "External", "").Element);
		assert.deepEqual(HeaderKeys(setup.List), ["sidebar_header_external"]);
		assert.deepEqual(saved, ["External", true]);
	});

	void it("영역 접힘 설정을 받으면 접힌 채로 시작한다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("Notes", "Notes", true)], { AreaCollapsed: { System: false, External: true } });
		assert.deepEqual(HeaderKeys(setup.List), ["sidebar_header_external"]);
	});

	void it("숨겨짐 그룹은 검색 대상에서 빠진다", () =>
	{
		const setup = Setup();
		const items = [Item("Notes", "Notes", true), Item("P4Util", "Perforce", true)];
		setup.Controller.Sync(items);
		const moved = PluginGroups.MoveItem(setup.Controller.Groups(), "External", "Notes", "hidden", 0);
		const hidden = PluginGroups.SetCollapsed(moved, "External", "hidden", false);	// 펼쳐 놓아도 검색에서는 빠져야 한다.
		setup.Controller.Sync(items, { Groups: hidden });
		assert.notEqual(setup.Controller.Find("Notes"), null);
		setup.Controller.Filter("note");
		assert.equal(setup.Controller.Find("Notes"), null);
		assert.deepEqual(HeaderKeys(setup.List), []);
	});

	void it("검색 중에는 접힌 그룹을 임시로 펼치고 저장된 접힘은 그대로 둔다", () =>
	{
		const setup = Setup();
		const items = [Item("Notes", "Notes", true)];
		setup.Controller.Sync(items);
		const collapsed = PluginGroups.SetCollapsed(setup.Controller.Groups(), "External", "default", true);
		setup.Controller.Sync(items, { Groups: collapsed });
		assert.equal(setup.Controller.Find("Notes"), null);
		setup.Controller.Filter("note");
		assert.notEqual(setup.Controller.Find("Notes"), null);
		assert.equal(PluginGroups.FindGroup(setup.Controller.Groups(), "External", "default")?.Collapsed, true);
		setup.Controller.Filter("");
		assert.equal(setup.Controller.Find("Notes"), null);
	});

	void it("매칭이 없는 그룹·영역 헤더는 숨는다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("ScouterCore", "Scouter Core", false), Item("Notes", "Notes", true)]);
		setup.Controller.Filter("core");
		assert.deepEqual(HeaderKeys(setup.List), ["sidebar_header_system", "group_System_default", "nav_ScouterCore"]);
	});

	void it("F2로 이름을 바꾸고 Enter로 확정한다", () =>
	{
		const setup = Setup();
		const items = [Item("Notes", "Notes", true)];
		let saved: IPluginGroupState | null = null;
		setup.Controller.Sync(items, { Groups: PluginGroups.AddGroup(PluginGroups.Empty(), "External", "작업"), OnGroupsChanged: (_state) => { saved = _state; } });
		const header = Header(setup.Controller, "External", "group-1");
		assert.equal(header.Title, "작업");
		PressKey(header.Element, "F2");
		assert.equal(header.IsEditing, true);
		const input = EditorOf(header);
		TypeInto(input, "내가 만든 그룹");
		PressKey(input, "Enter");
		assert.equal(header.IsEditing, false);
		assert.equal(header.Title, "내가 만든 그룹");
		assert.equal(PluginGroups.FindGroup(saved as unknown as IPluginGroupState, "External", "group-1")?.Name, "내가 만든 그룹");
	});

	void it("빈 이름은 거부하고 원래 이름을 유지한다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("Notes", "Notes", true)], { Groups: PluginGroups.AddGroup(PluginGroups.Empty(), "External", "작업") });
		const header = Header(setup.Controller, "External", "group-1");
		PressKey(header.Element, "F2");
		const input = EditorOf(header);
		TypeInto(input, "   ");
		PressKey(input, "Enter");
		assert.equal(header.Title, "작업");
		assert.equal(PluginGroups.FindGroup(setup.Controller.Groups(), "External", "group-1")?.Name, "작업");
	});

	void it("ESC면 편집을 버리고 이름을 되돌린다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("Notes", "Notes", true)], { Groups: PluginGroups.AddGroup(PluginGroups.Empty(), "External", "작업") });
		const header = Header(setup.Controller, "External", "group-1");
		PressKey(header.Element, "F2");
		const input = EditorOf(header);
		TypeInto(input, "버릴 이름");
		PressKey(input, "Escape");
		assert.equal(header.IsEditing, false);
		assert.equal(header.Title, "작업");
	});

	void it("고정 그룹은 이름 편집에 들어가지 못한다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("Notes", "Notes", true)]);
		const header = Header(setup.Controller, "External", "default");
		assert.equal(header.CanRename, false);
		assert.equal(header.BeginEdit(), false);
		PressKey(header.Element, "F2");
		assert.equal(header.IsEditing, false);
	});

	void it("헤더마다 우클릭 메뉴가 달린다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([Item("Notes", "Notes", true)]);
		assert.notEqual(setup.Controller.FindHeader("External", "")?.ContextMenu, null);
		assert.notEqual(setup.Controller.FindHeader("External", "default")?.ContextMenu, null);
		assert.notEqual(setup.Controller.Find("Notes")?.ContextMenu, null);
	});

	void it("드래그는 같은 그룹 안에서만 먹는다", () =>
	{
		const setup = Setup();
		const items = [Item("A", "A", true), Item("B", "B", true), Item("C", "C", true)];
		setup.Controller.Sync(items);
		const split = PluginGroups.MoveItem(PluginGroups.AddGroup(setup.Controller.Groups(), "External", "작업"), "External", "C", "group-1", 0);
		setup.Controller.Sync(items, { Groups: split, OnOrderChanged: () => undefined });
		assert.equal(setup.Controller.MoveBefore("A", "C", false), false);
		assert.equal(setup.Controller.MoveBefore("B", "A", false), true);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "default"), ["B", "A"]);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "group-1"), ["C"]);
	});

	void it("다른 그룹의 항목 사이로 떨어뜨리면 대상 그룹 원본 위치에 들어간다", () =>
	{
		const setup = Setup();
		const items = [Item("A", "A", true), Item("B", "B", true), Item("C", "C", true), Item("D", "D", true)];
		setup.Controller.Sync(items);
		let split = PluginGroups.AddGroup(setup.Controller.Groups(), "External", "작업");
		split = PluginGroups.MoveItem(split, "External", "C", "group-1", 0);
		split = PluginGroups.MoveItem(split, "External", "D", "group-1", 1);
		setup.Controller.Sync(items, { Groups: split, OnOrderChanged: () => undefined });
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "group-1"), ["C", "D"]);
		assert.equal(setup.Controller.Drop("A", { Kind: "Item", Key: "D", After: false }), true);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "group-1"), ["C", "A", "D"]);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "default"), ["B"]);
		assert.equal(setup.Controller.Drop("B", { Kind: "Item", Key: "D", After: true }), true);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "group-1"), ["C", "A", "D", "B"]);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "default"), []);
	});

	void it("같은 그룹 안 드롭은 끄는 항목을 뺀 배열이 기준이다", () =>
	{
		const setup = Setup();
		const items = [Item("A", "A", true), Item("B", "B", true), Item("C", "C", true), Item("D", "D", true)];
		setup.Controller.Sync(items, { OnOrderChanged: () => undefined });
		assert.equal(setup.Controller.Drop("A", { Kind: "Item", Key: "C", After: false }), true);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "default"), ["B", "A", "C", "D"]);	// 원본 기준이면 B,C,A,D가 된다.
	});

	void it("그룹 헤더에 떨어뜨리면 비었거나 접힌 그룹에도 들어간다", () =>
	{
		const setup = Setup();
		const items = [Item("A", "A", true), Item("B", "B", true)];
		setup.Controller.Sync(items);
		const folded = PluginGroups.SetCollapsed(PluginGroups.AddGroup(setup.Controller.Groups(), "External", "작업"), "External", "group-1", true);
		setup.Controller.Sync(items, { Groups: folded, OnOrderChanged: () => undefined });
		assert.equal(setup.Controller.Drop("A", { Kind: "Group", Key: "group-1", After: false }), true);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "group-1"), ["A"]);
		assert.equal(setup.Controller.Find("A"), null);	// 접힌 그룹으로 들어갔으니 화면에서는 빠진다.
		assert.equal(setup.Controller.Drop("B", { Kind: "Group", Key: "group-1", After: false }), true);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "group-1"), ["B", "A"]);	// 헤더 드롭은 그 그룹 맨 앞이다.
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "default"), []);
	});

	void it("영역을 넘는 드롭과 없는 그룹으로의 드롭은 거부한다", () =>
	{
		const setup = Setup();
		const items = [Item("ScouterCore", "Scouter Core", false), Item("Notes", "Notes", true)];
		setup.Controller.Sync(items, { Groups: PluginGroups.AddGroup(PluginGroups.Empty(), "External", "작업"), OnOrderChanged: () => undefined });
		assert.equal(setup.Controller.Drop("ScouterCore", { Kind: "Group", Key: "group-1", After: false }), false);
		assert.equal(setup.Controller.Drop("ScouterCore", { Kind: "Item", Key: "Notes", After: false }), false);
		assert.equal(setup.Controller.Drop("Notes", { Kind: "Item", Key: "ScouterCore", After: false }), false);
		assert.equal(setup.Controller.Drop("Notes", { Kind: "Group", Key: "group-9", After: false }), false);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "group-1"), []);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "System", "default"), ["ScouterCore"]);
		assert.deepEqual(GroupOf(setup.Controller.Groups(), "External", "default"), ["Notes"]);
	});

	void it("그룹 간 이동도 영역·항목·그룹·위치를 콜백으로 넘긴다", () =>
	{
		const setup = Setup();
		let saved: unknown[] = [];
		const items = [Item("A", "A", true), Item("B", "B", true), Item("C", "C", true)];
		setup.Controller.Sync(items);
		const split = PluginGroups.MoveItem(PluginGroups.AddGroup(setup.Controller.Groups(), "External", "작업"), "External", "C", "group-1", 0);
		setup.Controller.Sync(items, { Groups: split, OnOrderChanged: (_area, _itemId, _groupId, _index) => { saved = [_area, _itemId, _groupId, _index]; } });
		assert.equal(setup.Controller.Drop("A", { Kind: "Item", Key: "C", After: true }), true);
		assert.deepEqual(saved, ["External", "A", "group-1", 1]);
		assert.deepEqual(setup.Controller.ExternalIds(), ["B", "C", "A"]);
	});

	void it("Plugin.json 아이콘을 그대로 쓰고 없는 이름은 package로 떨어뜨린다", () =>
	{
		const setup = Setup();
		setup.Controller.Sync([
			{ Id: "ToastLab", Title: "Toast Lab", Icon: "bell", Source: "External", State: "Active" },
			{ Id: "CommandPalette", Title: "Command Palette", Icon: "command", Source: "BuiltIn", State: "Active" },
			{ Id: "Notes", Title: "Notes", Icon: "notes", Source: "External", State: "Active" },
			{ Id: "P4Util", Title: "Perforce Utilities", Icon: "p4", Source: "External", State: "Active" },
			{ Id: "NoIcon", Title: "No Icon", Icon: "", Source: "External", State: "Active" },
		]);
		assert.equal(IconOf(setup.Controller, "ToastLab"), "bell");
		assert.equal(IconOf(setup.Controller, "CommandPalette"), "command");
		assert.equal(IconOf(setup.Controller, "Notes"), "package");
		assert.equal(IconOf(setup.Controller, "P4Util"), "package");
		assert.equal(IconOf(setup.Controller, "NoIcon"), "package");
		for (const id of ["ToastLab", "Notes", "NoIcon"])
		{
			const href = setup.Controller.Find(id)?.Element.querySelector("use")?.getAttribute("href") ?? "";
			assert.ok(IconSprite.Has(href.replace("#", "")), `${id}/${href}`);	// 등록 안 된 이름이면 빈 칸으로 렌더된다.
		}
	});

	void it("정렬기준은 그룹 안에만 적용되고 그룹 순서는 유지된다", () =>
	{
		const setup = Setup();
		const items = [Item("A", "A", true), Item("B", "B", true), Item("C", "C", true)];
		setup.Controller.Sync(items);
		const split = PluginGroups.MoveItem(PluginGroups.AddGroup(setup.Controller.Groups(), "External", "작업"), "External", "A", "group-1", 0);
		setup.Controller.Sync(items, { Groups: split, SortMode: "MostClicked", Clicks: { A: 1, B: 2, C: 9 } });
		assert.deepEqual(HeaderKeys(setup.List), [
			"sidebar_header_external", "group_External_default", "nav_C", "nav_B", "group_External_hidden", "group_External_group-1", "nav_A",
		]);
	});
});
