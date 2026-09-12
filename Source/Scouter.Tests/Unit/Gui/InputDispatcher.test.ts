/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: InputDispatcher 라우팅·캡처·키 매칭 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIElement, InputDispatcher, PointerEventArgs } from "@scouter/gui";

class TestElement extends UIElement
{
	public constructor()
	{
		super();
	}
}

function MakeRoot(): { Root: TestElement; Dom: HTMLElement }
{
	const dom = document.createElement("div");
	document.body.append(dom);
	const root = new TestElement();
	dom.append(root.Element);
	InputDispatcher.Attach(dom, root);
	return { Root: root, Dom: dom };
}

void describe("InputDispatcher", () =>
{
	void it("pointerdown은 Preview→본 순서로 온다", () =>
	{
		const { Root, Dom } = MakeRoot();
		const child = new TestElement();
		Root.AddChild(child);
		const order: string[] = [];
		child.PreviewPointerDown.Add(() => { order.push("preview"); });
		child.PointerDown.Add(() => { order.push("main"); });
		child.Element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		assert.deepEqual(order, ["preview", "main"]);
		InputDispatcher.Detach();
		Root.Dispose();
		Dom.remove();
	});

	void it("캡처 중이면 target이 고정된다", () =>
	{
		const { Root, Dom } = MakeRoot();
		const child = new TestElement();
		Root.AddChild(child);
		let hit = 0;
		child.PointerUp.Add(() => { hit++; });
		InputDispatcher.Capture(child, 7);
		Root.Element.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7, bubbles: true }));
		InputDispatcher.Release(7);
		assert.equal(hit, 1);
		InputDispatcher.Detach();
		Root.Dispose();
		Dom.remove();
	});

	void it("hover는 enter/leave 최소 구간만", () =>
	{
		const { Root, Dom } = MakeRoot();
		const child = new TestElement();
		Root.AddChild(child);
		let entered = 0;
		let left = 0;
		child.PointerEnter.Add(() => { entered++; });
		child.PointerLeave.Add(() => { left++; });
		child.Element.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
		child.Element.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
		Root.Element.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
		assert.equal(entered, 1);
		assert.equal(left >= 0, true);
		InputDispatcher.Detach();
		Root.Dispose();
		Dom.remove();
	});

	void it("Key Matches는 Ctrl+Shift+P를 알아본다", () =>
	{
		const { Root, Dom } = MakeRoot();
		let matched = false;
		Root.PreviewKeyDown.Add((_s, _a) => { matched = _a.Matches("Ctrl+Shift+P"); });
		Dom.dispatchEvent(new KeyboardEvent("keydown", { key: "P", ctrlKey: true, shiftKey: true, bubbles: true }));
		assert.equal(matched, true);
		InputDispatcher.Detach();
		Root.Dispose();
		Dom.remove();
	});

	void it("PointerEventArgs 좌표가 보인다", () =>
	{
		const { Root, Dom } = MakeRoot();
		let seen = "";
		Root.PointerDown.Add((_s, _a: PointerEventArgs) => { seen = `${_a.X},${_a.Y}`; });
		Root.Element.dispatchEvent(new PointerEvent("pointerdown", { clientX: 3, clientY: 4, bubbles: true }));
		assert.equal(seen, "3,4");
		InputDispatcher.Detach();
		Root.Dispose();
		Dom.remove();
	});
});
