/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RangeBase 보정·NumericUpDown·RepeatButton 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Slider, NumericUpDown, ProgressBar, RepeatButton, InputDispatcher } from "@scouter/gui";

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

	void it("RepeatButton 키는 단발로 끝난다", async () =>
	{
		const btn = new RepeatButton();
		btn.SetValue(RepeatButton.DelayProperty, 40);
		const dom = document.createElement("div");
		document.body.append(dom);
		dom.append(btn.Element);
		InputDispatcher.Attach(dom, btn);
		try
		{
			let count = 0;
			btn.Click.Add(() => { count++; });
			btn.Focus();
			btn.Element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			assert.equal(count, 1);
			await new Promise((_resolve) => setTimeout(_resolve, 150));
			assert.equal(count, 1);
		}
		finally
		{
			InputDispatcher.Detach();
			btn.Dispose();
			dom.remove();
		}
	});

	void it("RepeatButton 누름은 반복하고 뗌에 멈춘다", async () =>
	{
		const btn = new RepeatButton();
		btn.SetValue(RepeatButton.DelayProperty, 30);
		const dom = document.createElement("div");
		document.body.append(dom);
		dom.append(btn.Element);
		InputDispatcher.Attach(dom, btn);
		try
		{
			let count = 0;
			btn.Click.Add(() => { count++; });
			btn.Element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
			await new Promise((_resolve) => setTimeout(_resolve, 400));
			assert.ok(count >= 2);
			btn.Element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
			const frozen = count;
			await new Promise((_resolve) => setTimeout(_resolve, 150));
			assert.equal(count, frozen);
		}
		finally
		{
			InputDispatcher.Detach();
			btn.Dispose();
			dom.remove();
		}
	});
});
