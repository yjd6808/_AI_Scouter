/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: GridSplitter 드래그·clamp 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Grid, GridSplitter, GridLength, ColumnDefinition, InputDispatcher, StackPanel } from "@scouter/gui";

function MockWidth(_el: HTMLElement, _w: number): void
{
	_el.getBoundingClientRect = () => ({ x: 0, y: 0, width: _w, height: 600, top: 0, left: 0, right: _w, bottom: 600, toJSON: () => undefined });
}

void describe("GridSplitter", () =>
{
	void it("pointer 드래그로 이전 열이 늘어난다", () =>
	{
		const grid = new Grid();
		const first = new ColumnDefinition(GridLength.Pixel(100));
		first.MinWidth = 48;
		first.MaxWidth = 400;
		const gap = new ColumnDefinition(GridLength.Pixel(4));
		const rest = new ColumnDefinition(GridLength.Parse("*"));
		grid.ColumnDefinitions.Add(first);
		grid.ColumnDefinitions.Add(gap);
		grid.ColumnDefinitions.Add(rest);
		const splitter = new GridSplitter();
		Grid.ColumnProperty.Set(splitter, 1);
		grid.AddChild(splitter);
		const dom = document.createElement("div");
		document.body.append(dom);
		dom.append(grid.Element);
		InputDispatcher.Attach(dom, grid);
		let completed = 0;
		splitter.DragCompleted.Add(() => { completed++; });
		splitter.Element.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, bubbles: true }));
		splitter.Element.dispatchEvent(new PointerEvent("pointermove", { clientX: 150, bubbles: true }));
		splitter.Element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
		assert.equal(completed, 1);
		InputDispatcher.Detach();
		grid.Dispose();
		dom.remove();
	});

	void it("가로지르는 형제가 먼저 있어도 이전 트랙을 실측한다", () =>
	{
		const grid = new Grid();
		const first = new ColumnDefinition(GridLength.Pixel(150));
		first.MinWidth = 48;
		first.MaxWidth = 600;
		grid.ColumnDefinitions.Add(first);
		grid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Pixel(8)));
		grid.ColumnDefinitions.Add(new ColumnDefinition(GridLength.Parse("*")));
		const spanner = new StackPanel();
		Grid.ColumnSpanProperty.Set(spanner, 3);
		MockWidth(spanner.Element, 1280);
		const sidebar = new StackPanel();
		Grid.ColumnProperty.Set(sidebar, 0);
		MockWidth(sidebar.Element, 150);
		const splitter = new GridSplitter();
		Grid.ColumnProperty.Set(splitter, 1);
		grid.AddChild(spanner);
		grid.AddChild(sidebar);
		grid.AddChild(splitter);
		const dom = document.createElement("div");
		document.body.append(dom);
		dom.append(grid.Element);
		InputDispatcher.Attach(dom, grid);
		splitter.Element.dispatchEvent(new PointerEvent("pointerdown", { clientX: 200, bubbles: true }));
		splitter.Element.dispatchEvent(new PointerEvent("pointermove", { clientX: 260, bubbles: true }));
		splitter.Element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
		assert.equal(Math.round(first.Length.Value), 210);
		InputDispatcher.Detach();
		grid.Dispose();
		dom.remove();
	});
});
