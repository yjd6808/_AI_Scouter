/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: BindingGraph 일괄·순환 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Binding, BindingGraph, ExpressionParser, UIElement, StackPanel } from "@scouter/gui";
import type { IBindingScope } from "@scouter/gui";
import { UIValues } from "@scouter/gui";

class Probe extends UIElement
{
	public constructor()
	{
		super();
	}
}

function FakeScope(): IBindingScope
{
	return {
		DataGet: () => UIValues.From(1),
		ElementProp: () => UIValues.Null(),
		RelativeProp: () => UIValues.Null(),
		SettingsGet: () => UIValues.Null(),
		ThemeToken: (_token) => `var(--${_token})`,
		EnvGet: () => UIValues.Null(),
		Trace: () => { /* 무시 */ },
	};
}

void describe("BindingGraph", () =>
{
	void it("MarkDirty 후 microtask 1회 재평가", async () =>
	{
		const graph = new BindingGraph();
		const target = new Probe();
		const parsed = new ExpressionParser().ParseValue("{@k}", false);
		assert.notEqual(parsed, null);
		if (parsed === null)
			return;
		const binding = new Binding(target, UIElement.OpacityProperty, parsed, FakeScope);
		binding.Evaluate();
		graph.Add(binding);
		graph.MarkDirty("@k");
		await new Promise((_resolve) => setTimeout(_resolve, 0));
		graph.Clear(target);
		target.Dispose();
	});

	void it("Clear 후 재평가 없음", () =>
	{
		const graph = new BindingGraph();
		const target = new StackPanel();
		assert.deepEqual(graph.DepKeys(), []);
		graph.Clear(target);
		target.Dispose();
	});
});
