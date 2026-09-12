/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: DataList 타입 강제·스냅샷 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DataList, DataType } from "@scouter/gui";

void describe("DataList", () =>
{
	void it("jc 별칭 정규화", () =>
	{
		assert.equal(DataList.NormalizeType("_u32"), DataType.Int);
		assert.equal(DataList.NormalizeType("_string"), DataType.String);
		assert.equal(DataList.NormalizeType("_f32"), DataType.Float);
		assert.equal(DataList.NormalizeType("_ptr"), null);
	});

	void it("타입 강제·미선언 throw", () =>
	{
		const data = new DataList();
		data.Declare("count", DataType.Int, "12");
		assert.equal(data.Get("count"), 12);
		assert.throws(() => { data.Declare("count", DataType.Int, "1"); });
		assert.throws(() => { data.Set("없음", 1); });
		assert.throws(() => { data.Declare("bad", DataType.Int, "xx"); });
	});

	void it("Update는 Changed 1회", () =>
	{
		const data = new DataList();
		data.Declare("a", DataType.Int, "1");
		data.Declare("b", DataType.String, "x");
		let calls = 0;
		data.Changed.Add((_keys) =>
		{
			calls++;
			assert.deepEqual(_keys, ["a", "b"]);
		});
		data.Update({ a: 2, b: "y" });
		assert.equal(calls, 1);
	});

	void it("Snapshot·Restore", () =>
	{
		const data = new DataList();
		data.Declare("n", DataType.Int, "1");
		data.Set("n", 5);
		const snap = data.Snapshot();
		data.Set("n", 9);
		data.Restore(snap);
		assert.equal(data.Get("n"), 5);
		assert.equal(data.TypeOf("n"), DataType.Int);
		assert.equal(data.TypeOf("없음"), null);
		assert.deepEqual(data.Keys(), ["n"]);
	});
});
