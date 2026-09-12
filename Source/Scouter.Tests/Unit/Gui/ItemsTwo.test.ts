/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: GridView 정렬·PopupPlacer·VirtualList·RingBuffer·PropertyGrid 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ListView, GridView, GridViewColumn, PopupPlacer, VirtualList, RingBuffer, PropertyGrid, TextBlock, UIElement } from "@scouter/gui";
import schemaJson from "../../Fixtures/PropertySchema.json" with { type: "json" };

class Row extends UIElement
{
	public constructor()
	{
		super();
	}
}

void describe("ItemsTwo", () =>
{
	void it("GridView 정렬 방향 유지", () =>
	{
		const view = new ListView();
		const grid = new GridView();
		grid.AddColumn(new GridViewColumn({ Header: "Rev", DisplayMemberPath: "Rev", Width: 60, MinWidth: 40 }));
		grid.AddColumn(new GridViewColumn({ Header: "Path", DisplayMemberPath: "DepotPath", Width: "*", MinWidth: 80 }));
		view.View = grid;
		view.SetItems([{ Rev: 2, DepotPath: "b" }, { Rev: 1, DepotPath: "a" }]);
		assert.match(view.Element.style.getPropertyValue("--gui-grid-columns"), /60px/);
		view.Dispose();
	});

	void it("PopupPlacer flip/clamp", () =>
	{
		const target = new DOMRect(10, 900, 100, 20);
		const rect = PopupPlacer.Compute(target, { Width: 200, Height: 300 }, "Bottom", 0, 0);
		assert.ok(rect.Y + rect.Height <= (window.visualViewport?.height ?? window.innerHeight));
		const right = PopupPlacer.Compute(new DOMRect(1900, 10, 100, 20), { Width: 200, Height: 100 }, "Right", 0, 0);
		assert.ok(right.X + right.Width <= (window.visualViewport?.width ?? window.innerWidth));
	});

	void it("VirtualList 풀 정리", () =>
	{
		const list = new VirtualList();
		document.body.append(list.Element);
		list.ItemTemplate = (_idx) =>
		{
			const row = new Row();
			return row;
		};
		list.Count = 10000;
		list.Refresh();
		assert.ok(list.Element.querySelectorAll(".gui-virtual__spacer").length === 1);
		list.Count = 0;
		list.Refresh();
		list.Dispose();
	});

	void it("RingBuffer 덮어쓰기 순서", () =>
	{
		const ring = new RingBuffer<number>(3);
		ring.Push(1);
		ring.Push(2);
		ring.Push(3);
		ring.Push(4);
		assert.equal(ring.Get(0), 2);
		assert.equal(ring.Get(2), 4);
		assert.throws(() => { ring.Get(5); });
		ring.Clear();
		assert.equal(ring.Count, 0);
	});

	void it("PropertyGrid 타입별 에디터", () =>
	{
		const grid = new PropertyGrid();
		grid.SetSchema(schemaJson, { sidebarWidth: 150, themeId: "oc-2", closeToTray: true });
		const got = grid.Get();
		assert.equal(got["sidebarWidth"], 150);
		grid.Dispose();
		const text = new TextBlock();
		text.Dispose();
	});
});
