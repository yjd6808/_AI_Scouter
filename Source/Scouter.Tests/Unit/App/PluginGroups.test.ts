/*
	작성자: 윤정도
	생성일: 2026-09-14
	=====
	설명: PluginGroups 정규화·이관·그룹 편집·그룹 내 정렬 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginGroups } from "../../../Scouter.App/Renderer/Plugin/PluginGroups";
import type { IPluginGroupState, TPluginGroupArea } from "../../../Scouter.App/Renderer/Plugin/PluginGroups";
import defaults from "../../../Scouter.App/Config/Defaults.json" with { type: "json" };

void describe("PluginGroups", () =>
{
	const groupIds = (_state: IPluginGroupState, _area: TPluginGroupArea): string[] => _state[_area].map((_group) => _group.Id);
	const itemsOf = (_state: IPluginGroupState, _area: TPluginGroupArea, _groupId: string): string[] => PluginGroups.FindGroup(_state, _area, _groupId)?.Items ?? [];
	const raw = (_system: unknown, _external: unknown): unknown => ({ System: _system, External: _external });

	// ==================== Normalize ====================

	void it("빈 값이면 두 영역에 고정 그룹 2개를 만든다", () =>
	{
		const state = PluginGroups.Normalize(null, [], []);
		assert.deepEqual(groupIds(state, "System"), ["default", "hidden"]);
		assert.deepEqual(groupIds(state, "External"), ["default", "hidden"]);
	});

	void it("고정 그룹은 이름·종류가 정해져 있고 숨겨짐만 접혀 있다", () =>
	{
		const state = PluginGroups.Normalize(undefined, [], []);
		assert.deepEqual(PluginGroups.FindGroup(state, "System", "default"), { Id: "default", Name: "기본", Kind: "Fixed", Collapsed: false, Items: [] });
		assert.deepEqual(PluginGroups.FindGroup(state, "External", "hidden"), { Id: "hidden", Name: "숨겨짐", Kind: "Fixed", Collapsed: true, Items: [] });
	});

	void it("깨진 값은 버리고 고정 그룹만 남긴다", () =>
	{
		const state = PluginGroups.Normalize(raw("nope", [1, null, "x", { Name: "Id 없음" }, { Id: "  " }]), [], []);
		assert.deepEqual(groupIds(state, "System"), ["default", "hidden"]);
		assert.deepEqual(groupIds(state, "External"), ["default", "hidden"]);
	});

	void it("문자열·배열을 통째로 저장했어도 되살린다", () =>
	{
		assert.deepEqual(groupIds(PluginGroups.Normalize("망가짐", [], []), "System"), ["default", "hidden"]);
		assert.deepEqual(groupIds(PluginGroups.Normalize([1, 2], [], []), "External"), ["default", "hidden"]);
	});

	void it("고정 그룹 이름·종류는 저장값을 무시하고 강제한다", () =>
	{
		const state = PluginGroups.Normalize(raw([{ Id: "default", Name: "내맘대로", Kind: "User", Collapsed: true, Items: [] }], []), [], []);
		const group = PluginGroups.FindGroup(state, "System", "default");
		assert.ok(group !== null);
		assert.equal(group.Name, "기본");
		assert.equal(group.Kind, "Fixed");
		assert.equal(group.Collapsed, true);
	});

	void it("중복 Id 그룹은 첫 그룹으로 항목을 합친다", () =>
	{
		const state = PluginGroups.Normalize(
			raw([], [{ Id: "g1", Name: "A", Collapsed: false, Items: ["Notes"] }, { Id: "g1", Name: "B", Collapsed: true, Items: ["P4Util"] }]),
			[], ["Notes", "P4Util"]);
		assert.deepEqual(groupIds(state, "External"), ["default", "g1", "hidden"]);
		assert.equal(PluginGroups.FindGroup(state, "External", "g1")?.Name, "A");
		assert.deepEqual(itemsOf(state, "External", "g1"), ["Notes", "P4Util"]);
		assert.deepEqual(itemsOf(state, "External", "default"), []);
	});

	void it("같은 플러그인이 두 그룹에 있으면 앞선 그룹만 남긴다", () =>
	{
		const state = PluginGroups.Normalize(
			raw([], [{ Id: "default", Name: "기본", Kind: "Fixed", Collapsed: false, Items: ["Notes"] }, { Id: "g1", Name: "작업", Collapsed: false, Items: ["Notes", "P4Util"] }]),
			[], ["Notes", "P4Util"]);
		assert.deepEqual(itemsOf(state, "External", "default"), ["Notes"]);
		assert.deepEqual(itemsOf(state, "External", "g1"), ["P4Util"]);
	});

	void it("그룹 안 중복 항목도 하나만 남긴다", () =>
	{
		const state = PluginGroups.Normalize(raw([], [{ Id: "default", Name: "기본", Collapsed: false, Items: ["Notes", "Notes", "P4Util"] }]), [], ["Notes", "P4Util"]);
		assert.deepEqual(itemsOf(state, "External", "default"), ["Notes", "P4Util"]);
	});

	void it("신규는 맨 아래가 아니라 기본 그룹 알파벳 위치에 넣는다", () =>
	{
		const state = PluginGroups.Normalize(
			raw([], [{ Id: "default", Name: "기본", Collapsed: false, Items: ["ControlLab", "P4Util"] }]),
			[], ["ControlLab", "Notes", "P4Util"]);
		assert.deepEqual(itemsOf(state, "External", "default"), ["ControlLab", "Notes", "P4Util"]);
	});

	void it("이미 다른 그룹에 있으면 신규로 보지 않는다", () =>
	{
		const state = PluginGroups.Normalize(
			raw([], [{ Id: "default", Name: "기본", Collapsed: false, Items: ["P4Util"] }, { Id: "g1", Name: "작업", Collapsed: false, Items: ["Notes"] }]),
			[], ["Notes", "P4Util"]);
		assert.deepEqual(itemsOf(state, "External", "default"), ["P4Util"]);
		assert.deepEqual(itemsOf(state, "External", "g1"), ["Notes"]);
	});

	void it("숨겨짐 그룹에 넣어둔 플러그인은 기본으로 끌려오지 않는다", () =>
	{
		const state = PluginGroups.Normalize(
			raw([], [{ Id: "hidden", Name: "숨겨짐", Collapsed: true, Items: ["Notes"] }]),
			[], ["Notes", "P4Util"]);
		assert.deepEqual(itemsOf(state, "External", "hidden"), ["Notes"]);
		assert.deepEqual(itemsOf(state, "External", "default"), ["P4Util"]);
	});

	void it("현재 목록에 없는 Id도 지우지 않는다. 리로드 일시 제거와 구분 불가", () =>
	{
		const state = PluginGroups.Normalize(raw([], [{ Id: "default", Name: "기본", Collapsed: false, Items: ["Gone", "Notes"] }]), [], ["Notes"]);
		assert.deepEqual(itemsOf(state, "External", "default"), ["Gone", "Notes"]);
	});

	void it("리로드 중 일시 제거돼도 그룹 배치를 유지한다", () =>
	{
		const first = PluginGroups.Normalize(raw([], [{ Id: "g1", Name: "작업", Collapsed: false, Items: ["Notes", "P4Util"] }]), [], ["Notes", "P4Util"]);
		const during = PluginGroups.Normalize(first, [], ["Notes"]);
		assert.deepEqual(itemsOf(during, "External", "g1"), ["Notes", "P4Util"]);
		const back = PluginGroups.Normalize(during, [], ["Notes", "P4Util"]);
		assert.deepEqual(itemsOf(back, "External", "g1"), ["Notes", "P4Util"]);
		assert.deepEqual(itemsOf(back, "External", "default"), []);
	});

	void it("영역이 뒤바뀐 항목은 올바른 영역 기본으로 되돌린다", () =>
	{
		const state = PluginGroups.Normalize(
			raw([], [{ Id: "default", Name: "기본", Collapsed: false, Items: ["ScouterCore", "Notes"] }]),
			["ScouterCore"], ["Notes"]);
		assert.deepEqual(itemsOf(state, "External", "default"), ["Notes"]);
		assert.deepEqual(itemsOf(state, "System", "default"), ["ScouterCore"]);
	});

	void it("되돌린 항목도 알파벳 위치에 들어간다", () =>
	{
		const state = PluginGroups.Normalize(
			raw([{ Id: "default", Name: "기본", Collapsed: false, Items: ["AaaCore", "ZzzCore"] }], [{ Id: "g1", Name: "작업", Collapsed: false, Items: ["MidCore"] }]),
			["AaaCore", "MidCore", "ZzzCore"], []);
		assert.deepEqual(itemsOf(state, "System", "default"), ["AaaCore", "MidCore", "ZzzCore"]);
		assert.deepEqual(itemsOf(state, "External", "g1"), []);
	});

	void it("고정 그룹 순서를 바꿔 저장했으면 그대로 둔다", () =>
	{
		const state = PluginGroups.Normalize(
			raw([{ Id: "hidden", Name: "숨겨짐", Collapsed: true, Items: [] }, { Id: "default", Name: "기본", Collapsed: false, Items: [] }], []),
			[], []);
		assert.deepEqual(groupIds(state, "System"), ["hidden", "default"]);
	});

	void it("사용자 그룹의 이름·접힘 상태를 유지한다", () =>
	{
		const state = PluginGroups.Normalize(raw([], [{ Id: "g7", Name: "자주 쓰는 것", Kind: "User", Collapsed: true, Items: [] }]), [], []);
		const group = PluginGroups.FindGroup(state, "External", "g7");
		assert.ok(group !== null);
		assert.equal(group.Name, "자주 쓰는 것");
		assert.equal(group.Kind, "User");
		assert.equal(group.Collapsed, true);
	});

	void it("정규화는 여러 번 돌려도 결과가 같다", () =>
	{
		const once = PluginGroups.Normalize(raw([], [{ Id: "g1", Name: "작업", Collapsed: false, Items: ["P4Util"] }]), ["ScouterCore"], ["Notes", "P4Util"]);
		assert.deepEqual(PluginGroups.Normalize(once, ["ScouterCore"], ["Notes", "P4Util"]), once);
	});

	// ==================== MigrateFromOrder ====================

	void it("기존 PluginOrder를 외부 기본 그룹 순서로 옮긴다", () =>
	{
		const state = PluginGroups.MigrateFromOrder(["P4Util", "Notes"], ["Notes", "P4Util", "ControlLab"]);
		assert.deepEqual(itemsOf(state, "External", "default"), ["ControlLab", "P4Util", "Notes"]);
	});

	void it("이관 결과에도 고정 그룹 2개가 있고 시스템 영역은 비어 있다", () =>
	{
		const state = PluginGroups.MigrateFromOrder(["Notes"], ["Notes"]);
		assert.deepEqual(groupIds(state, "System"), ["default", "hidden"]);
		assert.deepEqual(groupIds(state, "External"), ["default", "hidden"]);
		assert.deepEqual(itemsOf(state, "System", "default"), []);
	});

	void it("이관 뒤 정규화하면 시스템 플러그인이 채워진다", () =>
	{
		const migrated = PluginGroups.MigrateFromOrder(["P4Util", "Notes"], ["Notes", "P4Util"]);
		const state = PluginGroups.Normalize(migrated, ["ScouterCore"], ["Notes", "P4Util"]);
		assert.deepEqual(itemsOf(state, "System", "default"), ["ScouterCore"]);
		assert.deepEqual(itemsOf(state, "External", "default"), ["P4Util", "Notes"]);
	});

	void it("이관이 필요한 저장값인지 판정한다", () =>
	{
		assert.equal(PluginGroups.NeedsMigration(undefined), true);
		assert.equal(PluginGroups.NeedsMigration("망가짐"), true);
		assert.equal(PluginGroups.NeedsMigration(PluginGroups.Empty()), true);
		assert.equal(PluginGroups.NeedsMigration(PluginGroups.MigrateFromOrder(["Notes"], ["Notes"])), false);
	});

	// ==================== MoveItem ====================

	void it("항목을 다른 그룹으로 옮긴다", () =>
	{
		const base = PluginGroups.AddGroup(PluginGroups.Normalize(null, [], ["Notes", "P4Util"]), "External", "작업");
		const moved = PluginGroups.MoveItem(base, "External", "Notes", "group-1", 0);
		assert.deepEqual(itemsOf(moved, "External", "default"), ["P4Util"]);
		assert.deepEqual(itemsOf(moved, "External", "group-1"), ["Notes"]);
	});

	void it("그룹 안 위치도 바꾼다", () =>
	{
		const base = PluginGroups.Normalize(null, [], ["ControlLab", "Notes", "P4Util"]);
		const moved = PluginGroups.MoveItem(base, "External", "P4Util", "default", 0);
		assert.deepEqual(itemsOf(moved, "External", "default"), ["P4Util", "ControlLab", "Notes"]);
	});

	void it("영역을 넘는 이동은 거부하고 원본을 그대로 돌려준다", () =>
	{
		const base = PluginGroups.Normalize(null, ["ScouterCore"], ["Notes"]);
		assert.equal(PluginGroups.MoveItem(base, "External", "ScouterCore", "default", 0), base);
		assert.equal(PluginGroups.MoveItem(base, "System", "Notes", "hidden", 0), base);
	});

	void it("없는 대상 그룹은 거부한다", () =>
	{
		const base = PluginGroups.Normalize(null, [], ["Notes"]);
		assert.equal(PluginGroups.MoveItem(base, "External", "Notes", "없음", 0), base);
	});

	void it("범위를 벗어난 인덱스는 맨 뒤로 간다", () =>
	{
		const base = PluginGroups.Normalize(null, [], ["ControlLab", "Notes", "P4Util"]);
		assert.deepEqual(itemsOf(PluginGroups.MoveItem(base, "External", "ControlLab", "default", 99), "External", "default"), ["Notes", "P4Util", "ControlLab"]);
		assert.deepEqual(itemsOf(PluginGroups.MoveItem(base, "External", "P4Util", "default", -5), "External", "default"), ["P4Util", "ControlLab", "Notes"]);
		assert.deepEqual(itemsOf(PluginGroups.MoveItem(base, "External", "ControlLab", "default", Number.NaN), "External", "default"), ["Notes", "P4Util", "ControlLab"]);
	});

	void it("이동은 원본 상태를 변형하지 않는다", () =>
	{
		const base = PluginGroups.Normalize(null, [], ["Notes", "P4Util"]);
		PluginGroups.MoveItem(base, "External", "Notes", "hidden", 0);
		assert.deepEqual(itemsOf(base, "External", "default"), ["Notes", "P4Util"]);
		assert.deepEqual(itemsOf(base, "External", "hidden"), []);
	});

	// ==================== AddGroup ====================

	void it("사용자 그룹을 맨 뒤에 추가한다", () =>
	{
		const state = PluginGroups.AddGroup(PluginGroups.Empty(), "External", "  작업  ");
		assert.deepEqual(groupIds(state, "External"), ["default", "hidden", "group-1"]);
		const group = PluginGroups.FindGroup(state, "External", "group-1");
		assert.ok(group !== null);
		assert.equal(group.Name, "작업");
		assert.equal(group.Kind, "User");
		assert.equal(group.Collapsed, false);
	});

	void it("새 그룹 Id는 영역 안에서 겹치지 않는다", () =>
	{
		const once = PluginGroups.AddGroup(PluginGroups.Empty(), "System", "A");
		const twice = PluginGroups.AddGroup(once, "System", "B");
		assert.deepEqual(groupIds(twice, "System"), ["default", "hidden", "group-1", "group-2"]);
		const loaded = PluginGroups.Normalize(raw([{ Id: "group-1", Name: "이미", Collapsed: false, Items: [] }], []), [], []);
		assert.deepEqual(groupIds(PluginGroups.AddGroup(loaded, "System", "C"), "System"), ["default", "group-1", "hidden", "group-2"]);
	});

	void it("빈 이름은 거부한다", () =>
	{
		const base = PluginGroups.Empty();
		assert.equal(PluginGroups.AddGroup(base, "External", "   "), base);
	});

	// ==================== RenameGroup ====================

	void it("사용자 그룹 이름을 바꾼다", () =>
	{
		const base = PluginGroups.AddGroup(PluginGroups.Empty(), "External", "작업");
		assert.equal(PluginGroups.FindGroup(PluginGroups.RenameGroup(base, "External", "group-1", " 자주 씀 "), "External", "group-1")?.Name, "자주 씀");
	});

	void it("고정 그룹 이름 변경은 거부한다", () =>
	{
		const base = PluginGroups.Empty();
		assert.equal(PluginGroups.RenameGroup(base, "External", "default", "내기본"), base);
		assert.equal(PluginGroups.RenameGroup(base, "System", "hidden", "안보임"), base);
	});

	void it("없는 그룹·빈 이름의 이름 변경은 거부한다", () =>
	{
		const base = PluginGroups.AddGroup(PluginGroups.Empty(), "External", "작업");
		assert.equal(PluginGroups.RenameGroup(base, "External", "없음", "새이름"), base);
		assert.equal(PluginGroups.RenameGroup(base, "External", "group-1", "  "), base);
	});

	// ==================== RemoveGroup ====================

	void it("사용자 그룹을 지우고 항목을 기본으로 회수한다", () =>
	{
		const added = PluginGroups.AddGroup(PluginGroups.Normalize(null, [], ["ControlLab", "Notes", "P4Util"]), "External", "작업");
		const filled = PluginGroups.MoveItem(PluginGroups.MoveItem(added, "External", "P4Util", "group-1", 0), "External", "Notes", "group-1", 1);
		assert.deepEqual(itemsOf(filled, "External", "default"), ["ControlLab"]);
		const removed = PluginGroups.RemoveGroup(filled, "External", "group-1");
		assert.deepEqual(groupIds(removed, "External"), ["default", "hidden"]);
		assert.deepEqual(itemsOf(removed, "External", "default"), ["ControlLab", "P4Util", "Notes"]);
	});

	void it("고정 그룹·없는 그룹 삭제는 거부한다", () =>
	{
		const base = PluginGroups.Normalize(null, [], ["Notes"]);
		assert.equal(PluginGroups.RemoveGroup(base, "External", "default"), base);
		assert.equal(PluginGroups.RemoveGroup(base, "External", "hidden"), base);
		assert.equal(PluginGroups.RemoveGroup(base, "External", "없음"), base);
	});

	// ==================== MoveGroup ====================

	void it("그룹 순서를 바꾼다. 고정 그룹도 옮길 수 있다", () =>
	{
		const base = PluginGroups.AddGroup(PluginGroups.Empty(), "External", "작업");
		assert.deepEqual(groupIds(PluginGroups.MoveGroup(base, "External", "group-1", 0), "External"), ["group-1", "default", "hidden"]);
		assert.deepEqual(groupIds(PluginGroups.MoveGroup(base, "External", "hidden", 0), "External"), ["hidden", "default", "group-1"]);
	});

	void it("그룹 이동도 범위를 벗어나면 맨 뒤로 간다", () =>
	{
		const base = PluginGroups.AddGroup(PluginGroups.Empty(), "System", "작업");
		assert.deepEqual(groupIds(PluginGroups.MoveGroup(base, "System", "default", 99), "System"), ["hidden", "group-1", "default"]);
	});

	void it("없는 그룹 이동은 거부한다", () =>
	{
		const base = PluginGroups.Empty();
		assert.equal(PluginGroups.MoveGroup(base, "System", "없음", 0), base);
	});

	// ==================== SetCollapsed ====================

	void it("그룹 접힘 상태를 바꾸고 원본은 두지 않는다", () =>
	{
		const base = PluginGroups.Empty();
		const folded = PluginGroups.SetCollapsed(base, "External", "default", true);
		assert.equal(PluginGroups.FindGroup(folded, "External", "default")?.Collapsed, true);
		assert.equal(PluginGroups.FindGroup(base, "External", "default")?.Collapsed, false);
		assert.equal(PluginGroups.FindGroup(PluginGroups.SetCollapsed(base, "External", "hidden", false), "External", "hidden")?.Collapsed, false);
	});

	void it("없는 그룹 접힘 변경은 거부한다", () =>
	{
		const base = PluginGroups.Empty();
		assert.equal(PluginGroups.SetCollapsed(base, "System", "없음", true), base);
	});

	// ==================== 판정 ====================

	void it("숨김 그룹만 검색 제외 대상이다", () =>
	{
		assert.equal(PluginGroups.IsHiddenGroup("hidden"), true);
		assert.equal(PluginGroups.IsHiddenGroup("default"), false);
		assert.equal(PluginGroups.IsHiddenGroup("group-1"), false);
	});

	void it("고정 그룹은 default·hidden 둘뿐이다", () =>
	{
		assert.equal(PluginGroups.IsFixedGroup("default"), true);
		assert.equal(PluginGroups.IsFixedGroup("hidden"), true);
		assert.equal(PluginGroups.IsFixedGroup("group-1"), false);
	});

	void it("영역은 BuiltIn 여부로 갈린다", () =>
	{
		assert.equal(PluginGroups.AreaOf("BuiltIn"), "System");
		assert.equal(PluginGroups.AreaOf("External"), "External");
		assert.equal(PluginGroups.AreaOf("Dev"), "External");
	});

	// ==================== OrderWithin ====================

	void it("사용자 순서는 그룹의 항목 나열 순서를 따른다", () =>
	{
		const group = { Id: "g1", Name: "작업", Kind: "User" as const, Collapsed: false, Items: ["B", "A", "C"] };
		const items = [{ Id: "A", Name: "A" }, { Id: "B", Name: "B" }, { Id: "C", Name: "C" }];
		assert.deepEqual(PluginGroups.OrderWithin(group, items, "Custom", {}, {}).map((_item) => _item.Id), ["B", "A", "C"]);
	});

	void it("클릭 많은 순은 그룹 안에서만 적용된다", () =>
	{
		const group = { Id: "g1", Name: "작업", Kind: "User" as const, Collapsed: false, Items: ["B", "A", "C"] };
		const items = [{ Id: "A", Name: "A" }, { Id: "B", Name: "B" }, { Id: "C", Name: "C" }];
		assert.deepEqual(PluginGroups.OrderWithin(group, items, "MostClicked", { A: 5, B: 1, C: 3 }, {}).map((_item) => _item.Id), ["A", "C", "B"]);
	});

	void it("오래된 순도 그룹 안에서만 적용된다", () =>
	{
		const group = { Id: "g1", Name: "작업", Kind: "User" as const, Collapsed: false, Items: ["B", "A", "C"] };
		const items = [{ Id: "A", Name: "A" }, { Id: "B", Name: "B" }, { Id: "C", Name: "C" }];
		assert.deepEqual(PluginGroups.OrderWithin(group, items, "Oldest", {}, { A: 300, B: 100, C: 200 }).map((_item) => _item.Id), ["B", "C", "A"]);
	});

	void it("그룹에 없는 항목은 결과에서 빠진다", () =>
	{
		const group = { Id: "g1", Name: "작업", Kind: "User" as const, Collapsed: false, Items: ["B", "A"] };
		const items = [{ Id: "A", Name: "A" }, { Id: "B", Name: "B" }, { Id: "D", Name: "D" }];
		assert.deepEqual(PluginGroups.OrderWithin(group, items, "Custom", {}, {}).map((_item) => _item.Id), ["B", "A"]);
	});

	// ==================== 기본값 ====================

	void it("Defaults.json의 기본 구조는 정규화해도 그대로다", () =>
	{
		const state = PluginGroups.Normalize(defaults.Ui.PluginGroups, [], []);
		assert.deepEqual(state, PluginGroups.Empty());
	});
});
