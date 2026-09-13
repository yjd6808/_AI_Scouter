/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: 데스크톱 테마 엔진 테스트. OKLCH·해석·별칭 매핑.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OklchColor, DesktopResolver, ThemeResolver } from "@scouter/gui";
import type { IDesktopVariant, ITheme } from "@scouter/gui";

function MakePalette(): IDesktopVariant
{
	return {
		Palette: {
			Neutral: "#1f1f1f",
			Ink: "#f1ece8",
			Primary: "#fab283",
			Success: "#12c905",
			Warning: "#fcd53a",
			Error: "#fc533a",
			Info: "#edb2f1",
			Interactive: "#034cff",
		},
	};
}

function MakeSeeds(): IDesktopVariant
{
	return {
		Seeds: {
			Neutral: "#f7f7f7",
			Primary: "#dcde8d",
			Success: "#12c905",
			Warning: "#ffdc17",
			Error: "#fc533a",
			Info: "#a753ae",
			Interactive: "#034cff",
			DiffAdd: "#9ff29a",
			DiffDelete: "#fc533a",
		},
	};
}

void describe("DesktopTheme", () =>
{
	void it("hex 왕복이 유지된다", () =>
	{
		const back = OklchColor.OklchToHex(OklchColor.HexToOklch("#ff0000"));
		assert.deepEqual(OklchColor.HexToRgb(back), { R: 1, G: 0, B: 0 });
	});

	void it("스케일은 12단계 hex다", () =>
	{
		for (const dark of [true, false])
		{
			const scale = OklchColor.GenerateScale("#fab283", dark);
			assert.equal(scale.length, 12);
			for (const color of scale)
				assert.match(color, /^#[0-9a-f]{6}$/);
			const neutral = OklchColor.GenerateNeutralScale("#1f1f1f", dark, "#f1ece8");
			assert.equal(neutral.length, 12);
		}
	});

	void it("팔레트 변형이 풀린다", () =>
	{
		const dark = DesktopResolver.Resolve(MakePalette(), true);
		const light = DesktopResolver.Resolve(MakePalette(), false);
		assert.match(dark["background-base"] as string, /^#/);
		assert.match(light["background-base"] as string, /^#/);
		assert.notEqual(dark["background-base"], light["background-base"]);
		assert.ok(Object.keys(dark).length > 150);
	});

	void it("시드 변형이 풀린다", () =>
	{
		const dark = DesktopResolver.Resolve(MakeSeeds(), true);
		assert.match(dark["text-base"] as string, /^#/);
		assert.ok(Object.keys(dark).length > 150);
	});

	void it("잘못된 변형은 throw한다", () =>
	{
		assert.throws(() => { DesktopResolver.Resolve({}, true); });
		assert.throws(() => { DesktopResolver.Resolve({ ...MakePalette(), Seeds: MakeSeeds().Seeds }, true); });
	});

	void it("# 없는 오버라이드를 보정한다", () =>
	{
		const overrides: Record<string, string> = {};
		overrides["icon-weak-base"] = "C7C7C7";
		const resolved = DesktopResolver.Resolve({ ...MakePalette(), Overrides: overrides }, false);
		assert.equal(resolved["icon-weak-base"], "#C7C7C7");
	});

	void it("코어 별칭이 데스크톱 토큰을 탄다", () =>
	{
		const dark: Record<string, string> = {};
		dark["surface-brand-base"] = "#112233";
		dark["background-base"] = "#010101";
		const light: Record<string, string> = {};
		light["surface-brand-base"] = "#445566";
		light["background-base"] = "#fefefe";
		const theme: ITheme = {
			Id: "t", Name: "T", Source: "BuiltIn", Defs: {}, Tokens: {},
			HasLight: true, HasDark: true,
			Desktop: { Dark: dark, Light: light },
		};
		const resolvedDark = ThemeResolver.Resolve(theme, "Dark", null);
		assert.equal(resolvedDark.Tokens.get("primary"), "#112233");
		assert.equal(resolvedDark.Tokens.get("background-base"), "#010101");
		const resolvedLight = ThemeResolver.Resolve(theme, "Light", null);
		assert.equal(resolvedLight.Tokens.get("primary"), "#445566");
	});

	void it("CSS 변수 문자열을 만든다", () =>
	{
		const tokens: Record<string, string> = {};
		tokens["background-base"] = "#000000";
		const css = DesktopResolver.ToCss(tokens);
		assert.match(css, /--background-base: #000000;/);
	});
});
