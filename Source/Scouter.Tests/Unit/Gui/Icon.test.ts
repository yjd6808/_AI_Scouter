/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Icon use 갱신 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Icon } from "@scouter/gui";

void describe("Icon", () =>
{
	void it("Name이 use href에 반영된다", () =>
	{
		const icon = new Icon();
		icon.Name = "x";
		assert.equal(icon.Element.querySelector("use")?.getAttribute("href"), "#lucide-x");
		icon.Size = 24;
		assert.equal(icon.Element.style.width, "24px");
		icon.Dispose();
	});
});
