/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UIElement 트리·속성·폐기 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIElement, Visibility } from "@scouter/gui";

class TestElement extends UIElement
{
	public constructor()
	{
		super();
	}
}

class OtherElement extends UIElement
{
	public constructor()
	{
		super();
	}
}

void describe("UIElement", () =>
{
	void it("같은 값 SetValue는 DOM을 건드리지 않는다", () =>
	{
		const el = new TestElement();
		el.Opacity = 0.5;
		assert.equal(el.Element.style.opacity, "0.5");
		el.Opacity = 0.5;
		assert.equal(el.Element.style.opacity, "0.5");
		el.Dispose();
	});

	void it("15개 기본 속성이 DOM에 반영된다", () =>
	{
		const el = new TestElement();
		el.Name = "btn_run";
		assert.equal(el.Element.dataset["testid"], "btn_run");
		el.Width = 120;
		assert.equal(el.Element.style.width, "120px");
		el.Width = "Auto";
		assert.equal(el.Element.style.width, "");
		el.Visibility = Visibility.Collapsed;
		assert.equal(el.Element.style.display, "none");
		el.Visibility = Visibility.Hidden;
		assert.equal(el.Element.style.visibility, "hidden");
		el.IsEnabled = false;
		assert.equal(el.Element.hasAttribute("inert"), true);
		el.Focusable = true;
		assert.equal(el.Element.tabIndex, 0);
		el.Dispose();
	});

	void it("AddChild/RemoveChild가 DOM과 일치한다", () =>
	{
		const root = new TestElement();
		const child = new TestElement();
		root.AddChild(child);
		assert.equal(root.Element.contains(child.Element), true);
		assert.equal(child.Parent, root);
		root.RemoveChild(child, false);
		assert.equal(root.Element.contains(child.Element), false);
		assert.equal(child.Parent, null);
		child.Dispose();
		root.Dispose();
	});

	void it("IsEnabled는 자식으로 상속된다", () =>
	{
		const root = new TestElement();
		const child = new TestElement();
		root.AddChild(child);
		root.IsEnabled = false;
		assert.equal(child.Element.hasAttribute("inert"), true);
		child.IsEnabled = true;
		root.IsEnabled = true;
		assert.equal(child.Element.hasAttribute("inert"), false);
		root.Dispose();
	});

	void it("FindName은 재귀, 타입 불일치는 null", () =>
	{
		const root = new TestElement();
		const mid = new TestElement();
		const leaf = new OtherElement();
		leaf.Name = "target_deep";
		mid.AddChild(leaf);
		root.AddChild(mid);
		assert.equal(root.FindName(OtherElement, "target_deep"), leaf);
		assert.equal(root.FindName(TestElement, "target_deep"), null);
		assert.throws(() => root.RequireName(TestElement, "없음"));
		root.Dispose();
	});

	void it("Dispose는 자식까지 연쇄", () =>
	{
		const root = new TestElement();
		root.AddChild(new TestElement());
		document.body.append(root.Element);
		root.Dispose();
		assert.equal(document.body.contains(root.Element), false);
		root.Dispose();
	});
});
