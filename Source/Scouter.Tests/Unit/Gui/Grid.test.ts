/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Grid 축약 문법·자식 배치 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Grid, StackPanel } from "@scouter/gui";

void describe("Grid", () =>
{
	void it("축약 문법 파싱", async () =>
	{
		const grid = new Grid();
		grid.SetValue(Grid.RowDefinitionsProperty, "Auto,*,2*");
		grid.SetValue(Grid.ColumnDefinitionsProperty, "150,*");
		await Promise.resolve();
		await new Promise((_resolve) => setTimeout(_resolve, 0));
		assert.equal(grid.RowDefinitions.Count, 3);
		assert.equal(grid.ColumnDefinitions.Count, 2);
		assert.match(grid.Element.style.gridTemplateRows, /auto/);
		grid.Dispose();
	});

	void it("자식에 grid-area가 걸린다", () =>
	{
		const grid = new Grid();
		const child = new StackPanel();
		Grid.RowProperty.Set(child, 1);
		Grid.ColumnProperty.Set(child, 2);
		grid.AddChild(child);
		assert.equal(child.Element.style.gridRow, "2 / span 1");
		assert.equal(child.Element.style.gridColumn, "3 / span 1");
		grid.Dispose();
	});

	void it("붙임 속성 변경이 재배치를 탄다", () =>
	{
		const grid = new Grid();
		const child = new StackPanel();
		grid.AddChild(child);
		Grid.RowProperty.Set(child, 2);
		assert.equal(child.Element.style.gridRow, "3 / span 1");
		grid.Dispose();
	});
});
