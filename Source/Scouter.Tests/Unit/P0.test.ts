/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P0 더미 테스트. 골격 배선 확인용이다.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GuiVersion } from "@scouter/gui";

void describe("P0", () =>
{
	void it("버전을 노출한다", () =>
	{
		assert.equal(GuiVersion, "0.4.0");
	});
});
