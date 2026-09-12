/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Panels 커버리지 보충. Border·Canvas·균등 격자·Viewbox·Wrap.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Border, Canvas, UniformGrid, Viewbox, Stretch, WrapPanel, Orientation, StackPanel } from "@scouter/gui";

void describe("PanelsExtra", () =>
{
	void it("Border 브러시·반경·패딩", () =>
	{
		const border = new Border();
		border.SetValue(Border.BorderBrushProperty, "#fff");
		assert.equal(border.Element.style.borderStyle, "solid");
		border.SetValue(Border.CornerRadiusProperty, 6);
		assert.equal(border.Element.style.borderRadius, "6px");
		border.Background = "#000";
		assert.equal(border.Element.style.background, "#000");
		border.Child = new StackPanel();
		assert.notEqual(border.Child, null);
		border.Child = null;
		assert.equal(border.Child, null);
		border.Dispose();
	});

	void it("Canvas 붙임 좌표가 absolute로", () =>
	{
		const canvas = new Canvas();
		const child = new StackPanel();
		Canvas.LeftProperty.Set(child, 10);
		Canvas.TopProperty.Set(child, 20);
		Canvas.ZIndexProperty.Set(child, 3);
		canvas.AddChild(child);
		assert.equal(child.Element.style.position, "absolute");
		assert.equal(child.Element.style.left, "10px");
		assert.equal(child.Element.style.zIndex, "3");
		canvas.Dispose();
	});

	void it("UniformGrid 자동 행열", () =>
	{
		const grid = new UniformGrid();
		grid.AddChild(new StackPanel());
		grid.AddChild(new StackPanel());
		grid.AddChild(new StackPanel());
		grid.AddChild(new StackPanel());
		assert.match(grid.Element.style.gridTemplate, /repeat\(2, 1fr\)/);
		grid.Dispose();
	});

	void it("Viewbox None은 transform 제거", () =>
	{
		const box = new Viewbox();
		const child = new StackPanel();
		box.AddChild(child);
		box.Stretch = Stretch.None;
		assert.equal(child.Element.style.transform, "");
		box.Dispose();
	});

	void it("WrapPanel 방향·항목 크기", () =>
	{
		const wrap = new WrapPanel();
		wrap.Orientation = Orientation.Vertical;
		assert.equal(wrap.Element.classList.contains("is-vertical"), true);
		wrap.SetValue(WrapPanel.ItemWidthProperty, 100);
		const child = new StackPanel();
		wrap.AddChild(child);
		assert.equal(child.Element.style.width, "100px");
		wrap.Dispose();
	});

	void it("StackPanel 방향·간격", () =>
	{
		const stack = new WrapPanel();
		stack.SetValue(WrapPanel.ItemHeightProperty, 24);
		const child = new StackPanel();
		stack.AddChild(child);
		assert.equal(child.Element.style.height, "24px");
		stack.Dispose();
	});
});
