/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SizeObserver 스텁 트리거 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIElement, SizeObserver } from "@scouter/gui";

class TestElement extends UIElement
{
	public constructor()
	{
		super();
	}

	public LastW = -1;
	public LastH = -1;

	protected override OnSizeChanged(_w: number, _h: number): void
	{
		this.LastW = _w;
		this.LastH = _h;
	}
}

void describe("SizeObserver", () =>
{
	void it("Observe 후 NotifySizeChanged가 OnSizeChanged를 탄다", () =>
	{
		const el = new TestElement();
		SizeObserver.Observe(el);
		el.NotifySizeChanged(100, 50);
		assert.equal(el.LastW, 100);
		assert.equal(el.LastH, 50);
		SizeObserver.Unobserve(el);
		el.Dispose();
	});
});
