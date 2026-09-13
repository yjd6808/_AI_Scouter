/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 테마 엔진 테스트. 해석·CSS·린트·색.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ThemeResolver, ThemeCss, ThemeLint, Color } from "@scouter/gui";
import type { ITheme } from "@scouter/gui";

function Tokens(_pairs: Array<[string, { dark?: string; light?: string }]>): Record<string, { dark?: string; light?: string }>
{
	return Object.fromEntries(_pairs);
}

function MakeTheme(): ITheme
{
	return {
		Id: "t", Name: "T", Source: "BuiltIn",
		Defs: { panel: "#252526" },
		Tokens: Tokens([
			["background-base", { dark: "#1e1e1e", light: "#ffffff" }],
			["background-panel", { dark: "$panel" }],
			["text-base", { dark: "#cccccc", light: "#1e1e1e" }],
		]),
		HasLight: true,
		HasDark: true,
	};
}

void describe("ThemeEngine", () =>
{
	void it("defs 체인·누락 폴백", () =>
	{
		const resolved = ThemeResolver.Resolve(MakeTheme(), "Dark", null);
		assert.equal(resolved.Tokens.get("background-panel"), "#252526");
		assert.equal(resolved.Tokens.get("text-weak"), "#ff00ff");
	});

	void it("CSS 결정적 출력", () =>
	{
		const resolved = ThemeResolver.Resolve(MakeTheme(), "Light", null);
		const css = ThemeCss.Build(resolved, { FontSize: 13, FontFamily: "A", MonoFamily: "B" }, "Compact");
		assert.match(css, /--background-base:#ffffff;/);
		assert.match(css, /--gui-control-height:24px;/);
	});

	void it("폰트 크기에 컨트롤 높이가 연동된다", () =>
	{
		const resolved = ThemeResolver.Resolve(MakeTheme(), "Light", null);
		const normal13 = ThemeCss.Build(resolved, { FontSize: 13, FontFamily: "A", MonoFamily: "B" }, "Normal");
		assert.match(normal13, /--gui-control-height:28px;/);
		assert.match(normal13, /--gui-icon-size:16px;/);
		assert.match(normal13, /--gui-font-sm:12px;/);
		const normal20 = ThemeCss.Build(resolved, { FontSize: 20, FontFamily: "A", MonoFamily: "B" }, "Normal");
		assert.match(normal20, /--gui-control-height:43px;/);
		assert.match(normal20, /--gui-icon-size:23px;/);
		assert.match(normal20, /--gui-font-sm:19px;/);
		const compact20 = ThemeCss.Build(resolved, { FontSize: 20, FontFamily: "A", MonoFamily: "B" }, "Compact");
		assert.match(compact20, /--gui-control-height:37px;/);
	});

	void it("Lint 형식·대비", () =>
	{
		const bad: ITheme = { ...MakeTheme(), Tokens: Tokens([["text-base", { dark: "red" }]]) };
		const result = ThemeLint.Run(bad);
		assert.equal(result.Errors.length, 1);
		const low: ITheme = { ...MakeTheme(), Tokens: Tokens([["text-base", { dark: "#1e1e1e" }], ["background-base", { dark: "#1e1e1e" }]]) };
		assert.equal(ThemeLint.Run(low).Warnings.length, 1);
	});

	void it("Color 파싱·대비·이동", () =>
	{
		assert.deepEqual(Color.Parse("#fff"), { R: 255, G: 255, B: 255 });
		assert.equal(Color.Parse("xx"), null);
		const black = Color.Parse("#000000") as { R: number; G: number; B: number };
		const white = Color.Parse("#ffffff") as { R: number; G: number; B: number };
		assert.ok(Color.Contrast(black, white) > 15);
		assert.match(Color.Shift("#000000", 1), /#ffffff/);
	});
});
