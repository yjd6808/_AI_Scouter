/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Core 커버리지 보충. Dispose·조상·포커스·팩토리.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIElement, UIProperty, DisposableBag, Gui, KeyEventArgs, ValueChangedEventArgs, WheelEventArgs, RoutedEventArgs } from "@scouter/gui";

class TestElement extends UIElement
{
	public constructor()
	{
		super();
	}
}

void describe("CoreExtra", () =>
{
	void it("DisposableBag은 전부 1회씩 폐기", () =>
	{
		const bag = new DisposableBag();
		let count = 0;
		bag.Add({ Dispose: () => { count++; } });
		bag.Add({ Dispose: () => { count++; } });
		bag.Dispose();
		bag.Dispose();
		assert.equal(count, 2);
	});

	void it("ClearValue는 기본값으로 복귀", () =>
	{
		const el = new TestElement();
		el.Opacity = 0.2;
		el.ClearValue(UIElement.OpacityProperty);
		assert.equal(el.Opacity, 1);
		el.ClearValue(UIElement.OpacityProperty);
		el.Dispose();
	});

	void it("FindAncestor·IsAncestorOf", () =>
	{
		const root = new TestElement();
		const mid = new TestElement();
		const leaf = new TestElement();
		mid.AddChild(leaf);
		root.AddChild(mid);
		assert.equal(leaf.FindAncestor(TestElement), mid);
		assert.equal(root.IsAncestorOf(leaf), true);
		assert.equal(leaf.IsAncestorOf(root), false);
		root.Dispose();
	});

	void it("Focusable면 Focus true", () =>
	{
		const el = new TestElement();
		assert.equal(el.Focus(), false);
		el.Focusable = true;
		document.body.append(el.Element);
		assert.equal(el.Focus(), true);
		el.Dispose();
	});

	void it("ClearChildren은 전부 제거", () =>
	{
		const root = new TestElement();
		root.AddChild(new TestElement());
		root.AddChild(new TestElement());
		root.ClearChildren();
		assert.equal(root.Children.length, 0);
		root.Dispose();
	});

	void it("Gui 팩토리 등록·생성", () =>
	{
		Gui.RegisterBuiltInElements();
		Gui.RegisterBuiltInElements();
		assert.notEqual(Gui.CreateElement("Grid"), null);
		assert.equal(Gui.CreateElement("Test/없음"), null);
		assert.equal(Gui.Version, "0.4.0");
	});

	void it("UIProperty AllOf·ParseLength 오류", () =>
	{
		assert.ok(UIProperty.AllOf(TestElement).length > 0);
		assert.throws(() => UIProperty.ParseLength("xx"));
	});

	void it("Key Matches 부정·Wheel·ValueChanged", () =>
	{
		const el = new TestElement();
		const args = new KeyEventArgs(el, new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
		assert.equal(args.Matches("Ctrl+Shift+P"), false);
		assert.equal(args.Matches("Ctrl+B"), true);
		const wheel = new WheelEventArgs(el, new WheelEvent("wheel", { deltaY: 5 }));
		assert.equal(wheel.DeltaY, 5);
		const changed = new ValueChangedEventArgs<number>(el, 1, 2);
		assert.equal(changed.NewValue, 2);
		const routed = new RoutedEventArgs(el);
		assert.equal(routed.Handled, false);
		el.Dispose();
	});
});
