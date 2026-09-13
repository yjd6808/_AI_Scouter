/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: SidebarController 항목·구분색·선택 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StackPanel, ToggleButton } from "@scouter/gui";
import type { ShellWindow } from "../../../Scouter.App/Renderer/Shell/ShellWindow";
import { SidebarController } from "../../../Scouter.App/Renderer/Shell/SidebarController";
import type { ISidebarItem } from "../../../Scouter.App/Renderer/Shell/SidebarController";

function Setup(): { Controller: SidebarController; List: StackPanel }
{
	const list = new StackPanel();
	const shell = { Navigate: (_id: string): void => undefined } as unknown as ShellWindow;
	return { Controller: new SidebarController(list, shell), List: list };
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
		setup.Controller.Rebuild(items);
		assert.equal(setup.Controller.Find("ScouterCore")?.Element.classList.contains("is-core"), true);
		assert.equal(setup.Controller.Find("ScouterCore")?.Element.classList.contains("is-external"), false);
		assert.equal(setup.Controller.Find("Notes")?.Element.classList.contains("is-external"), true);
		assert.equal(setup.Controller.Find("Notes")?.Element.classList.contains("is-core"), false);
	});

	void it("선택은 하나만 남는다", () =>
	{
		const setup = Setup();
		setup.Controller.Rebuild([
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
		setup.Controller.Rebuild([
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
		setup.Controller.Rebuild([
			{ Id: "ScouterCore", Title: "Scouter Core", Icon: "package", Source: "BuiltIn", State: "Active" },
			{ Id: "Notes", Title: "Notes", Icon: "package", Source: "External", State: "Active" },
		]);
		const root = setup.List.Element;
		assert.notEqual(root.querySelector("[data-testid=\"sidebar_header_system\"]"), null);
		assert.notEqual(root.querySelector("[data-testid=\"sidebar_header_external\"]"), null);
	});

	void it("드래그 순서 변경은 콜백으로 외부 Id를 넘긴다", () =>
	{
		const setup = Setup();
		let saved: string[] = [];
		setup.Controller.Rebuild([
			{ Id: "A", Title: "A", Icon: "package", Source: "External", State: "Active" },
			{ Id: "B", Title: "B", Icon: "package", Source: "External", State: "Active" },
			{ Id: "C", Title: "C", Icon: "package", Source: "External", State: "Active" },
		], { SortMode: "Custom", OnOrderChanged: (_ids) => { saved = _ids; } });
		assert.equal(setup.Controller.MoveBefore("C", "A", false), true);
		assert.deepEqual(setup.Controller.ExternalIds(), ["C", "A", "B"]);
		assert.deepEqual(saved, ["C", "A", "B"]);
	});

	void it("시스템 항목은 드래그 대상이 아니다", () =>
	{
		const setup = Setup();
		setup.Controller.Rebuild([
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
		setup.Controller.Rebuild(items, { SortMode: "MostClicked", OnOrderChanged: () => undefined });
		assert.notEqual(setup.Controller.Find("Notes")?.Element.style.cursor, "grab");
		setup.Controller.Rebuild(items, { SortMode: "Custom", OnOrderChanged: () => undefined });
		assert.equal(setup.Controller.Find("Notes")?.Element.style.cursor, "grab");
	});
});
