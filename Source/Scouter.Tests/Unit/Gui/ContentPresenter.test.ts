/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ContentPresenter 분리·재부착 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ContentPresenter, UserControl } from "@scouter/gui";

class ViewA extends UserControl
{
}

class ViewB extends UserControl
{
}

void describe("ContentPresenter", () =>
{
	void it("Detach 후 요소가 살고 재부착된다", () =>
	{
		const presenter = new ContentPresenter();
		const a = new ViewA();
		const b = new ViewB();
		presenter.Content = a;
		assert.equal(presenter.Element.contains(a.Element), true);
		const detached = presenter.Detach();
		assert.equal(detached, a);
		assert.equal(presenter.Element.contains(a.Element), false);
		presenter.Content = b;
		presenter.Content = a;
		assert.equal(presenter.Element.contains(a.Element), true);
		presenter.Dispose();
		a.Dispose();
		b.Dispose();
	});
});
