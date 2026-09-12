/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: GridSplitter 드래그·clamp 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Grid, GridSplitter, GridLength, ColumnDefinition, InputDispatcher } from "@scouter/gui";

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
});
