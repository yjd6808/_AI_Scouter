/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: 공용 틱(TickService) 타이머 공유·주기·예외 격리 테스트.
*/

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TickService } from "../../../Scouter.App/Renderer/Services/TickService";

void describe("TickService", () =>
{
	void it("구독자가 여럿이어도 타이머는 1개만 돈다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		let first = 0;
		let second = 0;
		const a = TickService.Add("A", () => { ++first; });
		const b = TickService.Add("B", () => { ++second; });
		assert.equal(TickService.IsRunning, true);
		assert.equal(TickService.BasePeriodMs, 1000);
		mock.timers.tick(1000);
		assert.deepEqual([first, second], [1, 1]);
		mock.timers.tick(1000);
		assert.deepEqual([first, second], [2, 2]);
		a.Dispose();
		assert.equal(TickService.IsRunning, true);
		b.Dispose();
		assert.equal(TickService.IsRunning, false);
		assert.equal(TickService.Count, 0);
		mock.timers.tick(5000);
		assert.deepEqual([first, second], [2, 2]);
		TickService.Reset();
		mock.timers.reset();
	});

	void it("구독이 다시 들어오면 타이머를 다시 켠다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		let count = 0;
		TickService.Add("A", () => { ++count; }).Dispose();
		assert.equal(TickService.IsRunning, false);
		const again = TickService.Add("A", () => { ++count; });
		assert.equal(TickService.IsRunning, true);
		mock.timers.tick(1000);
		assert.equal(count, 1);
		again.Dispose();
		TickService.Reset();
		mock.timers.reset();
	});

	void it("PeriodMs가 다르면 각자 주기대로 불린다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		let fast = 0;
		let slow = 0;
		TickService.Add("Fast", () => { ++fast; }, { PeriodMs: 1000 });
		TickService.Add("Slow", () => { ++slow; }, { PeriodMs: 3000 });
		assert.equal(TickService.BasePeriodMs, 1000);
		mock.timers.tick(3000);
		assert.deepEqual([fast, slow], [3, 1]);
		mock.timers.tick(3000);
		assert.deepEqual([fast, slow], [6, 2]);
		TickService.Reset();
		mock.timers.reset();
	});

	void it("한 구독자가 터져도 나머지는 계속 불린다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		let good = 0;
		TickService.Add("Bad", () => { throw new Error("의도적 실패"); });
		TickService.Add("Good", () => { ++good; });
		mock.timers.tick(1000);
		mock.timers.tick(1000);
		assert.equal(good, 2);
		TickService.Reset();
		mock.timers.reset();
	});

	void it("Visible이 거짓이면 건너뛴다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		let shown = 0;
		let visible = false;
		TickService.Add("View", () => { ++shown; }, { Visible: () => visible });
		mock.timers.tick(2000);
		assert.equal(shown, 0);
		visible = true;
		mock.timers.tick(1000);
		assert.equal(shown, 1);
		TickService.Reset();
		mock.timers.reset();
	});

	void it("이중 Dispose·RemoveAll은 멱등이다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		const sub = TickService.Add("Own", () => undefined);
		sub.Dispose();
		sub.Dispose();
		assert.equal(TickService.CountOf("Own"), 0);
		const other = TickService.Add("Own", () => undefined);
		TickService.RemoveAll("Own");
		other.Dispose();
		assert.equal(TickService.CountOf("Own"), 0);
		assert.equal(TickService.IsRunning, false);
		TickService.RemoveAll("없는소유자");
		TickService.Reset();
		mock.timers.reset();
	});
});
