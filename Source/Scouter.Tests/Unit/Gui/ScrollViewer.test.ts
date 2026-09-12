/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ScrollViewer 끝 판정·스크롤 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ScrollViewer, ScrollBarVisibility } from "@scouter/gui";

void describe("ScrollViewer", () =>
{
	void it("overflow 매핑", () =>
	{
		const viewer = new ScrollViewer();
		viewer.SetValue(ScrollViewer.VerticalScrollBarVisibilityProperty, ScrollBarVisibility.Hidden);
		assert.equal(viewer.Element.style.overflowY, "hidden");
		viewer.Dispose();
	});

	void it("내용 없으면 끝으로 본다", () =>
	{
		const viewer = new ScrollViewer();
		assert.equal(viewer.IsAtEnd, true);
		viewer.ScrollToEnd();
		viewer.Dispose();
	});
});
