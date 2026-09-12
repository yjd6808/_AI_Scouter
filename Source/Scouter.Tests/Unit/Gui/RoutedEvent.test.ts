/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RoutedEvent 터널·버블·차단 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIElement, RoutedEvent, RoutedEventArgs, RoutingStrategy, Visibility } from "@scouter/gui";

class TestElement extends UIElement
{
	public constructor()
	{
		super();
	}

	public readonly BubbleEvt = new RoutedEvent<RoutedEventArgs>("BubbleEvt", RoutingStrategy.Bubble);
	public readonly TunnelEvt = new RoutedEvent<RoutedEventArgs>("TunnelEvt", RoutingStrategy.Tunnel);
	public readonly DirectEvt = new RoutedEvent<RoutedEventArgs>("DirectEvt", RoutingStrategy.Direct);
}

void describe("RoutedEvent", () =>
{
	void it("Bubble은 self→root 순서", () =>
	{
		const root = new TestElement();
		const child = new TestElement();
		root.AddChild(child);
		const order: string[] = [];
		root.BubbleEvt.Add(() => { order.push("root"); });
		child.BubbleEvt.Add(() => { order.push("child"); });
		child.RaiseEvent(child.BubbleEvt, new RoutedEventArgs(child));
		assert.deepEqual(order, ["child", "root"]);
		root.Dispose();
	});

	void it("Tunnel은 root→self 순서", () =>
	{
		const root = new TestElement();
		const child = new TestElement();
		root.AddChild(child);
		const order: string[] = [];
		root.TunnelEvt.Add(() => { order.push("root"); });
		child.TunnelEvt.Add(() => { order.push("child"); });
		child.RaiseEvent(child.TunnelEvt, new RoutedEventArgs(child));
		assert.deepEqual(order, ["root", "child"]);
		root.Dispose();
	});

	void it("Handled면 중단", () =>
	{
		const root = new TestElement();
		const child = new TestElement();
		root.AddChild(child);
		let rootHit = false;
		child.BubbleEvt.Add((_s, _a) => { _a.Handled = true; });
		root.BubbleEvt.Add(() => { rootHit = true; });
		child.RaiseEvent(child.BubbleEvt, new RoutedEventArgs(child));
		assert.equal(rootHit, false);
		root.Dispose();
	});

	void it("Direct는 자기만", () =>
	{
		const root = new TestElement();
		const child = new TestElement();
		root.AddChild(child);
		let rootHit = false;
		root.DirectEvt.Add(() => { rootHit = true; });
		child.RaiseEvent(child.DirectEvt, new RoutedEventArgs(child));
		assert.equal(rootHit, false);
		root.Dispose();
	});

	void it("Add 반환 Disposable로 제거", () =>
	{
		const el = new TestElement();
		let count = 0;
		const sub = el.BubbleEvt.Add(() => { count++; });
		el.RaiseEvent(el.BubbleEvt, new RoutedEventArgs(el));
		sub.Dispose();
		el.RaiseEvent(el.BubbleEvt, new RoutedEventArgs(el));
		assert.equal(count, 1);
		assert.equal(el.Visibility, Visibility.Visible);
		el.Dispose();
	});
});
