/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: DockPanel 슬라이스 구조 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DockPanel, Dock, StackPanel } from "@scouter/gui";

void describe("DockPanel", () =>
{
	void it("Left,Top,Fill 순서로 slice가 생긴다", async () =>
	{
		const dock = new DockPanel();
		const left = new StackPanel();
		const top = new StackPanel();
		const fill = new StackPanel();
		DockPanel.DockProperty.Set(left, Dock.Left);
		DockPanel.DockProperty.Set(top, Dock.Top);
		dock.AddChild(left);
		dock.AddChild(top);
		dock.AddChild(fill);
		await new Promise((_resolve) => setTimeout(_resolve, 0));
		assert.equal(dock.Element.children.length, 3);
		assert.equal(fill.Parent, dock);
		dock.Dispose();
	});
});
