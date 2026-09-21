/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: Schedule 소유자 정리·해제 멱등 테스트.
*/

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { Schedule } from "../../../Scouter.App/Renderer/Services/Schedule";

const kNever = "0 0 1 1 *";

void describe("Schedule", () =>
{
	void it("Interval도 소유자 목록에 담겨 RemoveAll로 정리된다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		let count = 0;
		Schedule.Interval("Owner", 100, () => { ++count; });
		assert.equal(Schedule.CountOf("Owner"), 1);
		mock.timers.tick(100);
		assert.equal(count, 1);
		Schedule.RemoveAll("Owner");
		assert.equal(Schedule.CountOf("Owner"), 0);
		mock.timers.tick(1000);
		assert.equal(count, 1);
		mock.timers.reset();
	});

	void it("Interval Disposable도 목록에서 빠진다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		const sub = Schedule.Interval("Owner", 100, () => undefined);
		assert.equal(Schedule.CountOf("Owner"), 1);
		sub.Dispose();
		assert.equal(Schedule.CountOf("Owner"), 0);
		mock.timers.reset();
	});

	void it("cron 해제는 배열에서도 원소를 뺀다", () =>
	{
		const first = Schedule.Add("Cron", kNever, () => undefined);
		const second = Schedule.Add("Cron", kNever, () => undefined);
		assert.equal(Schedule.CountOf("Cron"), 2);
		first.Dispose();
		assert.equal(Schedule.CountOf("Cron"), 1);
		second.Dispose();
		assert.equal(Schedule.CountOf("Cron"), 0);
	});

	void it("등록·해제를 반복해도 참조가 쌓이지 않는다", () =>
	{
		for (let idx = 0; idx < 10; ++idx)
		{
			const sub = Schedule.Add("Loop", kNever, () => undefined);
			sub.Dispose();
		}
		assert.equal(Schedule.CountOf("Loop"), 0);
	});

	void it("두 번 Dispose·RemoveAll 뒤 Dispose도 안전하다", () =>
	{
		const sub = Schedule.Add("Idem", kNever, () => undefined);
		sub.Dispose();
		sub.Dispose();
		assert.equal(Schedule.CountOf("Idem"), 0);
		const other = Schedule.Add("Idem", kNever, () => undefined);
		Schedule.RemoveAll("Idem");
		other.Dispose();
		assert.equal(Schedule.CountOf("Idem"), 0);
		Schedule.RemoveAll("Idem");
		Schedule.RemoveAll("없는소유자");
	});
});
