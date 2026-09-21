/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: 데스크톱 테마 엔진 테스트. OKLCH·해석·별칭 매핑.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OklchColor, DesktopResolver, ThemeResolver, ThemeCss } from "@scouter/gui";
import type { IDesktopVariant, ITheme, ITypography } from "@scouter/gui";

function Luminance(_r: number, _g: number, _b: number): number
{
	const lift = (_v: number): number =>
	{
		const s = _v / 255;
		return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lift(_r) + 0.7152 * lift(_g) + 0.0722 * lift(_b);
}

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

	void it("오버레이 스크림이 반투명으로 생성된다", () =>
	{
		for (const variant of [MakePalette(), MakeSeeds()])
		{
			for (const isDark of [true, false])
			{
				const tokens = DesktopResolver.Resolve(variant, isDark);
				for (const key of ["overlay-scrim", "overlay-scrim-weak"])
				{
					const found = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(tokens[key] ?? "");
					assert.ok(found !== null, `${key}/${String(isDark)}`);
					const alpha = Number(found[4]);
					assert.ok(alpha > 0 && alpha < 1, `${key} 알파 ${String(alpha)}`);	// 불투명하면 아래 내용이 안 비쳐 모달 맥락이 사라진다.
				}
				assert.notEqual(tokens["overlay-scrim"], tokens["overlay-scrim-weak"]);
			}
		}
	});

	void it("스크림 시드는 중립 스케일의 어두운 끝을 고른다", () =>
	{
		// 다크 시드(#1f1f1f)는 다크 스킴에서, 라이트 시드(#f7f7f7)는 라이트 스킴에서 제 방향이다.
		const cases: Array<{ Variant: IDesktopVariant; IsDark: boolean }> = [
			{ Variant: MakePalette(), IsDark: true },
			{ Variant: MakeSeeds(), IsDark: false },
		];
		for (const entry of cases)
		{
			const tokens = DesktopResolver.Resolve(entry.Variant, entry.IsDark);
			const found = /^rgba\((\d+), (\d+), (\d+),/.exec(tokens["overlay-scrim"] ?? "");
			assert.ok(found !== null);
			const lum = Luminance(Number(found[1]), Number(found[2]), Number(found[3]));
			assert.ok(lum < 0.2, `딤이 밝다: ${String(lum)}`);
		}
	});

	void it("스크림 토큰이 실제 CSS 변수로 나온다", () =>
	{
		const theme: ITheme = {
			Id: "t", Name: "T", Source: "BuiltIn", Defs: {}, Tokens: {},
			HasLight: true, HasDark: true,
			Desktop: {
				Dark: DesktopResolver.Resolve(MakePalette(), true),
				Light: DesktopResolver.Resolve(MakePalette(), false),
			},
		};
		const typo: ITypography = { FontSize: 13, FontFamily: "sans-serif", MonoFamily: "monospace" };
		for (const scheme of ["Dark", "Light"] as const)
		{
			const resolved = ThemeResolver.Resolve(theme, scheme, null);
			assert.notEqual(resolved.Tokens.get("overlay-scrim"), "#ff00ff");	// 코어 토큰 폴백(마젠타)으로 새지 않아야 한다.
			const css = ThemeCss.Build(resolved, typo, "Normal");
			assert.ok(css.includes(`--overlay-scrim:${resolved.Tokens.get("overlay-scrim") ?? "?"};`), scheme);
			assert.ok(css.includes("--overlay-scrim-weak:"), scheme);
		}
	});

	void it("스크림은 오버라이드로 덮을 수 있다", () =>
	{
		const overrides: Record<string, string> = {};
		overrides["overlay-scrim"] = "rgba(0, 0, 0, 0.8)";
		const tokens = DesktopResolver.Resolve({ ...MakePalette(), Overrides: overrides }, true);
		assert.equal(tokens["overlay-scrim"], "rgba(0, 0, 0, 0.8)");
	});
});
