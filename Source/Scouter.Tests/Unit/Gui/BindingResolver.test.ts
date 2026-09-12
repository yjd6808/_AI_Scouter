/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 평가기 연산 규칙·함수 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingResolver, ExpressionParser, UIValues, UIValueKind } from "@scouter/gui";
import type { IBindingScope, UIValue } from "@scouter/gui";

function Scope(_data: Record<string, UIValue>): IBindingScope
{
	return {
		DataGet: (_key) =>
		{
			const found = _data[_key];
			if (found === undefined)
				throw new Error("E022");
			return found;
		},
		ElementProp: () => UIValues.Null(),
		RelativeProp: () => UIValues.Null(),
		SettingsGet: () => UIValues.Null(),
		ThemeToken: (_token) => `var(--${_token})`,
		EnvGet: () => UIValues.Null(),
		Trace: () => { /* 수집 안 함 */ },
	};
}

function Eval(_expr: string, _data: Record<string, UIValue>): UIValue
{
	return BindingResolver.Evaluate(new ExpressionParser().ParseText(_expr), Scope(_data));
}

void describe("BindingResolver", () =>
{
	void it("사칙·Int/Int 나눗셈은 Float", () =>
	{
		assert.deepEqual(Eval("1 + 2 * 3", {}), { Kind: UIValueKind.Int, Value: 7 });
		assert.deepEqual(Eval("7 / 2", {}), { Kind: UIValueKind.Float, Value: 3.5 });
	});

	void it("문자열+숫자는 연결", () =>
	{
		const v = Eval("`n=` + 3", {});
		assert.equal(v.Kind, UIValueKind.String);
	});

	void it("비교·논리·삼항", () =>
	{
		assert.deepEqual(Eval("1 < 2", {}), { Kind: UIValueKind.Bool, Value: true });
		assert.deepEqual(Eval("`b` > `a`", {}), { Kind: UIValueKind.Bool, Value: true });
		assert.deepEqual(Eval("1 == 1 && 2 != 3", {}), { Kind: UIValueKind.Bool, Value: true });
		assert.deepEqual(Eval("1 > 2 ? `y` : `n`", {}), { Kind: UIValueKind.String, Value: "n" });
	});

	void it("함수 10종", () =>
	{
		assert.deepEqual(Eval("clamp(10, 1, 5)", {}), { Kind: UIValueKind.Int, Value: 5 });
		assert.deepEqual(Eval("len(`abcd`)", {}), { Kind: UIValueKind.Int, Value: 4 });
		assert.deepEqual(Eval("str(12)", {}), { Kind: UIValueKind.String, Value: "12" });
		assert.deepEqual(Eval("max(1, 9, 3)", {}), { Kind: UIValueKind.Int, Value: 9 });
	});

	void it("참조 해결·Trace", () =>
	{
		const traced: string[] = [];
		const scope = Scope({ k: UIValues.From(3) });
		const tracing: IBindingScope = { ...scope, Trace: (_dep) => { traced.push(_dep); } };
		const v = BindingResolver.Evaluate(new ExpressionParser().ParseText("{@k} + 1"), tracing);
		assert.deepEqual(v, { Kind: UIValueKind.Int, Value: 4 });
		assert.deepEqual(traced, ["@k"]);
	});
});
