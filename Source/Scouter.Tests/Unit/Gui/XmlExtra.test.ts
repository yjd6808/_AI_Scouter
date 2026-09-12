/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Xml 커버리지 보충. 평가기·DataList 분기·카탈로그·조각 로드.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingResolver, ExpressionParser, DataList, DataType, ElementCatalog, Grid, UIValues, UIValueKind, XmlLoader, LoadContext, BindingGraph, Window, StackPanel, AttributeApplier } from "@scouter/gui";
import type { IBindingScope, UIValue } from "@scouter/gui";

function Scope(): IBindingScope
{
	return {
		DataGet: () => UIValues.Null(),
		ElementProp: () => UIValues.Null(),
		RelativeProp: () => UIValues.Null(),
		SettingsGet: () => UIValues.Null(),
		ThemeToken: (_token) => `var(--${_token})`,
		EnvGet: () => UIValues.Null(),
		Trace: () => { /* 무시 */ },
	};
}

function Eval(_expr: string): UIValue
{
	return BindingResolver.Evaluate(new ExpressionParser().ParseText(_expr), Scope());
}

void describe("XmlExtra", () =>
{
	void it("평가기 나머지 분기", () =>
	{
		assert.deepEqual(Eval("abs(0 - 3)"), { Kind: UIValueKind.Int, Value: 3 });
		assert.deepEqual(Eval("floor(1.7)"), { Kind: UIValueKind.Int, Value: 1 });
		assert.deepEqual(Eval("ceil(1.2)"), { Kind: UIValueKind.Int, Value: 2 });
		assert.deepEqual(Eval("round(1.5)"), { Kind: UIValueKind.Int, Value: 2 });
		assert.deepEqual(Eval("min(4, 2)"), { Kind: UIValueKind.Int, Value: 2 });
		assert.deepEqual(Eval("num(`12`)"), { Kind: UIValueKind.Int, Value: 12 });
		assert.deepEqual(Eval("10 % 3"), { Kind: UIValueKind.Int, Value: 1 });
		assert.deepEqual(Eval("1 / 0"), UIValues.Null());
		assert.deepEqual(Eval("0 - 5"), { Kind: UIValueKind.Int, Value: -5 });
		assert.deepEqual(Eval("!0"), { Kind: UIValueKind.Bool, Value: true });
		assert.deepEqual(Eval("2 >= 2"), { Kind: UIValueKind.Bool, Value: true });
		assert.deepEqual(Eval("2 <= 1"), { Kind: UIValueKind.Bool, Value: false });
	});

	void it("바깥 연산자는 전체 식", () =>
	{
		const parsed = new ExpressionParser().ParseValue("{@a} + 10", false);
		assert.equal(parsed?.Mode, "Expression");
		const nested = new ExpressionParser().ParseText("({@a} > 1) ? max(1, 2) : min(3, 4)");
		assert.equal(nested.Kind, "Ternary");
	});

	void it("DataList Array·Map 강제", () =>
	{
		const data = new DataList();
		data.Declare("arr", DataType.Array, "[1,2]");
		assert.deepEqual(data.Get("arr"), [1, 2]);
		data.Declare("map", DataType.Map, "{\"a\":1}");
		assert.deepEqual(data.Get("map"), { a: 1 });
		data.Declare("flag", DataType.Bool, "true");
		assert.equal(data.Get("flag"), true);
		data.Declare("pi", DataType.Float, "3.5");
		assert.equal(data.Get("pi"), 3.5);
		data.Declare("s", DataType.String, "hi");
		assert.equal(data.Get("s"), "hi");
		assert.throws(() => { data.Declare("bad", DataType.Array, "xx"); });
		assert.throws(() => { data.Declare("bad2", DataType.Map, "xx"); });
		assert.throws(() => { data.Declare("bad3", DataType.Float, "xx"); });
		assert.throws(() => { data.Declare("bad4", DataType.Map, "{"); });
	});

	void it("ElementCatalog 조회", () =>
	{
		assert.equal(ElementCatalog.Has("Grid"), true);
		assert.equal(ElementCatalog.Has("Nope"), false);
		assert.ok(ElementCatalog.PropertiesOf("Grid").length > 0);
		assert.deepEqual(ElementCatalog.PropertiesOf("Nope"), []);
		assert.ok(ElementCatalog.Names().includes("StackPanel"));
	});

	void it("조각 로드·텍스트·이벤트·커맨드", () =>
	{
		const host = new Window();
		const ctx = new LoadContext();
		ctx.Graph = new BindingGraph();
		ctx.Handlers = { OnGo: () => { /* 핸들러 */ } };
		const el = XmlLoader.LoadFragment("<Grid><StackPanel Name=\"frag_list\" /></Grid>", ctx, host);
		assert.notEqual(el, null);
		assert.equal(XmlLoader.LoadFragment("<Nope/>", new LoadContext(), host), null);
		const grid = new Grid();
		AttributeApplier.Apply(grid, "Command", "Shell.ToggleSidebar", ctx);
		assert.equal(AttributeApplier.CommandOf(grid), "Shell.ToggleSidebar");
		AttributeApplier.Apply(grid, "CommandParameter", "P4Util", ctx);
		assert.equal(AttributeApplier.CommandParameterOf(grid), "P4Util");
		host.Dispose();
		grid.Dispose();
	});

	void it("상대 참조·테마·환경", () =>
	{
		const host = new Window();
		const ctx = new LoadContext();
		ctx.Graph = new BindingGraph();
		ctx.Env.set("PluginId", "P4Util");
		const xml = "<Window><Grid><StackPanel Name=\"rel_a\" Opacity=\"{$env.PluginId}\" /><StackPanel Name=\"rel_b\" Opacity=\"{#rel_a.Opacity}\" /></Grid></Window>";
		const result = XmlLoader.LoadWindowInto(host, xml, ctx);
		assert.equal(result.Ok, true);
		host.Dispose();
		const stack = new StackPanel();
		stack.Dispose();
	});
});
