/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: PluginOrder 확정·정렬기준 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginOrder } from "../../../Scouter.App/Renderer/Plugin/PluginOrder";

void describe("PluginOrder", () =>
{
	void it("최초 로드면 알파벳 순서로 확정한다", () =>
	{
		assert.deepEqual(PluginOrder.EnsureExternalOrder([], ["P4Util", "Notes", "ControlLab"]), ["ControlLab", "Notes", "P4Util"]);
	});

	void it("리로드해도 기존 순서를 유지한다", () =>
	{
		const order = ["P4Util", "ControlLab", "Notes"];
		assert.deepEqual(PluginOrder.EnsureExternalOrder(order, ["Notes", "P4Util", "ControlLab"]), order);
	});

	void it("신규는 맨 아래가 아니라 알파벳 위치에 삽입한다", () =>
	{
		assert.deepEqual(
			PluginOrder.EnsureExternalOrder(["P4Util", "ToastLab"], ["P4Util", "Notes", "ToastLab"]),
			["Notes", "P4Util", "ToastLab"]);
	});

	void it("사라진 Id도 유지한다. 리로드 일시 제거와 구분 불가", () =>
	{
		assert.deepEqual(PluginOrder.EnsureExternalOrder(["Gone", "Notes", "P4Util"], ["Notes", "P4Util"]), ["Gone", "Notes", "P4Util"]);
	});

	void it("리로드 중 일시 제거돼도 드래그 순서를 유지한다", () =>
	{
		const dragged = ["ToastLab", "P4Util", "Notes"];
		const duringReload = PluginOrder.EnsureExternalOrder(dragged, ["ToastLab", "P4Util"]);
		assert.deepEqual(duringReload, dragged);
		assert.deepEqual(PluginOrder.EnsureExternalOrder(duringReload, ["ToastLab", "P4Util", "Notes"]), dragged);
	});

	void it("클릭 많은 순은 order를 무시한다", () =>
	{
		const items = [{ Id: "A", Name: "A" }, { Id: "B", Name: "B" }, { Id: "C", Name: "C" }];
		const sorted = PluginOrder.SortExternal(items, ["A", "B", "C"], { A: 1, B: 9, C: 3 }, {}, "MostClicked");
		assert.deepEqual(sorted.map((_item) => _item.Id), ["B", "C", "A"]);
	});

	void it("클릭 동점이면 이름 알파벳순이다", () =>
	{
		const items = [{ Id: "B", Name: "Bravo" }, { Id: "A", Name: "Alpha" }];
		const sorted = PluginOrder.SortExternal(items, ["B", "A"], {}, {}, "MostClicked");
		assert.deepEqual(sorted.map((_item) => _item.Id), ["A", "B"]);
	});

	void it("오래된 순은 최초 확인 시각순이다", () =>
	{
		const items = [{ Id: "A", Name: "A" }, { Id: "B", Name: "B" }, { Id: "C", Name: "C" }];
		const sorted = PluginOrder.SortExternal(items, ["C", "B", "A"], {}, { A: 300, B: 100, C: 200 }, "Oldest");
		assert.deepEqual(sorted.map((_item) => _item.Id), ["B", "C", "A"]);
	});

	void it("시각 미기록은 맨 뒤로 간다", () =>
	{
		const items = [{ Id: "A", Name: "A" }, { Id: "New", Name: "New" }];
		const sorted = PluginOrder.SortExternal(items, ["New", "A"], {}, { A: 100 }, "Oldest");
		assert.deepEqual(sorted.map((_item) => _item.Id), ["A", "New"]);
	});

	void it("사용자 순서는 저장 order를 따른다", () =>
	{
		const items = [{ Id: "A", Name: "A" }, { Id: "B", Name: "B" }];
		const sorted = PluginOrder.SortExternal(items, ["B", "A"], { A: 99 }, { A: 1, B: 2 }, "Custom");
		assert.deepEqual(sorted.map((_item) => _item.Id), ["B", "A"]);
	});

	void it("시스템 영역은 항상 이름 알파벳순이다", () =>
	{
		const items = [{ Id: "ScouterCore", Name: "Scouter Core" }, { Id: "CommandPalette", Name: "Command Palette" }];
		assert.deepEqual(PluginOrder.SortBuiltIn(items).map((_item) => _item.Id), ["CommandPalette", "ScouterCore"]);
	});

	void it("최초 확인 시각은 빈 슬롯만 채운다", () =>
	{
		assert.deepEqual(PluginOrder.EnsureFirstSeen({ A: 100 }, ["A", "B"], 200), { A: 100, B: 200 });
	});

	void it("이상한 정렬값은 사용자 순서로 굳힌다", () =>
	{
		assert.equal(PluginOrder.NormalizeSort("random"), "Custom");
		assert.equal(PluginOrder.NormalizeSort("MostClicked"), "MostClicked");
		assert.equal(PluginOrder.NormalizeSort(undefined), "Custom");
	});
});
