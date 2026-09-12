/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ToggleButton 2상태·aria 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToggleButton } from "@scouter/gui";

void describe("ToggleButton", () =>
{
	void it("클릭마다 뒤집힌다", () =>
	{
		const toggle = new ToggleButton();
		assert.equal(toggle.IsChecked, false);
		toggle.IsChecked = true;
		assert.equal(toggle.Element.classList.contains("is-checked"), true);
		assert.equal(toggle.Element.getAttribute("aria-pressed"), "true");
		toggle.IsChecked = false;
		assert.equal(toggle.Element.getAttribute("aria-pressed"), "false");
		toggle.Dispose();
	});
});
