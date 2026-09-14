/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: IconSprite 주입 테스트.
*/

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { IconSprite } from "@scouter/gui";

void describe("IconSprite", () =>
{
	after(() =>
	{
		IconSprite.ResetForTest();
		IconSprite.Ensure();
	});

	void it("심볼이 1회만 주입된다", () =>
	{
		IconSprite.ResetForTest();
		IconSprite.Ensure();
		IconSprite.Ensure();
		const nodes = document.querySelectorAll("#scouter-icon-sprite");
		assert.equal(nodes.length, 1);
		const svg = document.getElementById("scouter-icon-sprite");
		assert.ok(svg?.querySelector("#lucide-x") !== null);
		assert.ok(svg?.querySelector("#lucide-chrome-minimize") !== null);
		assert.ok(svg?.querySelector("#lucide-square") !== null);
		assert.ok(svg?.querySelector("#lucide-pin") !== null);
		assert.ok(svg?.querySelector("#lucide-pin-off") !== null);
	});

	void it("Ids에 창 버튼이 있다", () =>
	{
		const ids = IconSprite.Ids();
		assert.ok(ids.includes("lucide-chrome-minimize"));
		assert.ok(ids.includes("lucide-square"));
		assert.ok(ids.includes("lucide-copy"));
		assert.ok(ids.includes("lucide-x"));
		assert.ok(ids.includes("lucide-pin"));
		assert.ok(ids.includes("lucide-chevrons-left"));
		assert.ok(ids.includes("lucide-chevrons-right"));
	});
});
