/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Button Variant·아이콘·키·커맨드 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Button, InputDispatcher } from "@scouter/gui";

function Setup(_btn: Button): HTMLElement
{
	const dom = document.createElement("div");
	document.body.append(dom);
	dom.append(_btn.Element);
	InputDispatcher.Attach(dom, _btn);
	return dom;
}

void describe("Button", () =>
{
	void it("Variant 클래스·아이콘 표시", () =>
	{
		const btn = new Button();
		btn.Variant = "Primary";
		assert.equal(btn.Element.classList.contains("variant-primary"), true);
		btn.Icon = "search";
		const use = btn.Element.querySelector("use");
		assert.equal(use?.getAttribute("href"), "#lucide-search");
		btn.Dispose();
	});

	void it("Enter/Space가 Click을 쏜다", () =>
	{
		const btn = new Button();
		const dom = Setup(btn);
		let count = 0;
		btn.Click.Add(() => { count++; });
		btn.Focus();
		btn.Element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		btn.Element.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
		assert.equal(count, 2);
		InputDispatcher.Detach();
		btn.Dispose();
		dom.remove();
	});

	void it("IsEnabled false면 무반응", () =>
	{
		const btn = new Button();
		const dom = Setup(btn);
		let count = 0;
		btn.Click.Add(() => { count++; });
		btn.IsEnabled = false;
		btn.Element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		btn.Element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
		assert.equal(count, 0);
		InputDispatcher.Detach();
		btn.Dispose();
		dom.remove();
	});
});
