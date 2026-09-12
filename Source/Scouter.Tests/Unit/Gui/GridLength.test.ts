/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: GridLength 파싱·CSS 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GridLength, GridUnitType } from "@scouter/gui";

void describe("GridLength", () =>
{
	void it("6종 파싱", () =>
	{
		assert.equal(GridLength.Parse("*").Unit, GridUnitType.Star);
		assert.equal(GridLength.Parse("2*").Value, 2);
		assert.equal(GridLength.Parse("Auto").Unit, GridUnitType.Auto);
		assert.equal(GridLength.Parse("150").Value, 150);
		assert.throws(() => GridLength.Parse("xx"));
	});

	void it("ToCss 변환", () =>
	{
		assert.equal(GridLength.Parse("*").ToCss(0, 9999), "minmax(0px, 1fr)");
		assert.equal(GridLength.Parse("Auto").ToCss(0, 9999), "auto");
		assert.equal(GridLength.Parse("150").ToCss(0, 9999), "150px");
	});

	void it("Pixel clamp", () =>
	{
		assert.equal(GridLength.Pixel(500).ToCss(48, 400), "400px");
		assert.equal(GridLength.Pixel(10).ToCss(48, 400), "48px");
	});
});
