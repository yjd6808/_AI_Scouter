/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: CheckBox 박스·체크·aria 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CheckBox, InputDispatcher } from "@scouter/gui";

void describe("CheckBox", () =>
{
	void it("박스와 체크 아이콘을 렌더한다", () =>
	{
		const box = new CheckBox();
		const frame = box.Element.querySelector(".gui-checkbox__box");
		assert.notEqual(frame, null);
		assert.notEqual(frame?.querySelector("svg path"), null);
		assert.equal(box.Element.getAttribute("role"), "checkbox");
		box.Dispose();
	});

	void it("클릭하면 체크 표시와 aria가 바뀐다", () =>
	{
		const box = new CheckBox();
		const dom = document.createElement("div");
		document.body.append(dom);
		dom.append(box.Element);
		InputDispatcher.Attach(dom, box);
		box.Element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		box.Element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
		assert.equal(box.IsChecked, true);
		assert.equal(box.Element.classList.contains("is-checked"), true);
		assert.equal(box.Element.getAttribute("aria-checked"), "true");
		const icon = box.Element.querySelector(".gui-checkbox__box") as HTMLElement;
		assert.notEqual(icon, null);
		InputDispatcher.Detach();
		box.Dispose();
		dom.remove();
	});
});
