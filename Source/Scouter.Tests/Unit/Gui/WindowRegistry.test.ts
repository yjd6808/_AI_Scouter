/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: WindowRegistry 데코레이터 등록 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Window, WindowRegistry, RegisterWindow } from "@scouter/gui";

@RegisterWindow("Test/RegA")
class RegA extends Window
{
}

void describe("WindowRegistry", () =>
{
	void it("데코레이터 등록·조회", () =>
	{
		assert.equal(WindowRegistry.Resolve("Test/RegA"), RegA);
		assert.equal(WindowRegistry.Resolve("Test/없음"), null);
	});

	void it("중복 이름은 throw", () =>
	{
		assert.throws(() => { WindowRegistry.Register("Test/RegA", RegA); });
	});

	void it("Unregister 뒤 재등록된다", () =>
	{
		assert.equal(WindowRegistry.Unregister("Test/RegTmp"), false);
		WindowRegistry.Register("Test/RegTmp", RegA);
		assert.equal(WindowRegistry.Resolve("Test/RegTmp"), RegA);
		assert.equal(WindowRegistry.Unregister("Test/RegTmp"), true);
		assert.equal(WindowRegistry.Resolve("Test/RegTmp"), null);
		WindowRegistry.Register("Test/RegTmp", RegA);
		assert.equal(WindowRegistry.Unregister("Test/RegTmp"), true);
	});
});
