/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UIProperty 등록·조회·파싱 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIProperty } from "@scouter/gui";
import { Thickness } from "@scouter/gui";

class OwnerA
{
	public static readonly CountProperty = UIProperty.Register<number>("Count", OwnerA, { Default: 0, Parse: (_text) => Number(_text) });
}

class OwnerB extends OwnerA
{
}

void describe("UIProperty", () =>
{
	void it("중복 등록하면 throw", () =>
	{
		assert.throws(() => UIProperty.Register<number>("Count", OwnerA, { Default: 1 }));
	});

	void it("프로토타입 체인으로 조회된다", () =>
	{
		assert.equal(UIProperty.Lookup(OwnerB, "Count"), OwnerA.CountProperty);
		assert.equal(UIProperty.Lookup(OwnerA, "Nope"), null);
	});

	void it("기본 파싱은 number/boolean/string 추론", () =>
	{
		const prop = UIProperty.Register<string>("Any", OwnerB, { Default: "" });
		assert.equal(prop.Parse("12"), 12);
		assert.equal(prop.Parse("true"), true);
		assert.equal(prop.Parse("abc"), "abc");
	});

	void it("Thickness 파싱 1/2/4항", () =>
	{
		assert.deepEqual(Thickness.Parse("8").ToCss(), "8px 8px 8px 8px");
		assert.deepEqual(Thickness.Parse("8,4").ToCss(), "4px 8px 4px 8px");
		assert.throws(() => Thickness.Parse("a,b"));
	});

	void it("함수형 기본값은 호출마다 생성", () =>
	{
		const prop = UIProperty.Register<Thickness>("Pad", OwnerB, { Default: () => new Thickness(1, 1, 1, 1) });
		assert.notEqual(prop.GetDefault(), prop.GetDefault());
	});
});
