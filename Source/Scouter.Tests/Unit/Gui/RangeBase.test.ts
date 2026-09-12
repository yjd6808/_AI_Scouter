/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RangeBase 보정·NumericUpDown 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Slider, NumericUpDown, ProgressBar } from "@scouter/gui";

void describe("RangeBase", () =>
{
	void it("Min≤Value≤Max 보정", () =>
	{
		const slider = new Slider();
		slider.Minimum = 10;
		slider.Maximum = 20;
		slider.Value = 99;
		assert.equal(slider.Value, 20);
		slider.Value = 1;
		assert.equal(slider.Value, 10);
		slider.Dispose();
	});

	void it("NumericUpDown 스핀·커밋", () =>
	{
		const num = new NumericUpDown();
		num.Minimum = 0;
		num.Maximum = 10;
		num.Value = 5;
		let changed = 0;
		num.ValueChanged.Add(() => { changed++; });
		num.Value = 7;
		assert.equal(changed, 1);
		const bar = new ProgressBar();
		bar.Maximum = 100;
		bar.Value = 45;
		assert.match(bar.Element.innerHTML, /45%/);
		num.Dispose();
		bar.Dispose();
	});
});
