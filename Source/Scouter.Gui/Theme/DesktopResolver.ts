/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: DesktopResolver. 시드·팔레트 변형을 토큰 맵으로 푼다.
*/

import { OklchColor } from "./OklchColor";
import type { IDesktopVariant, IThemePaletteColors, IThemeSeedColors } from "./DesktopTheme";

interface IThemeColors
{
	Compact: boolean;
	Neutral: string;
	Ink?: string;
	Primary: string;
	Accent: string;
	Success: string;
	Warning: string;
	Error: string;
	Info: string;
	Interactive: string;
	DiffAdd?: string;
	DiffDelete?: string;
}

export class DesktopResolver
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 변형 1개를 토큰 맵으로 푼다. seeds·palette 중 하나만 있어야 한다.
	// @param _variant: 변형
	// @param _isDark: 다크 여부
	public static Resolve(_variant: IDesktopVariant, _isDark: boolean): Record<string, string>
	{
		const colors = DesktopResolver.GetColors(_variant);
		const overrides = _variant.Overrides ?? {};
		const neutral = OklchColor.GenerateNeutralScale(colors.Neutral, _isDark, colors.Ink);
		const primary = OklchColor.GenerateScale(colors.Primary, _isDark);
		const accent = OklchColor.GenerateScale(colors.Accent, _isDark);
		const success = OklchColor.GenerateScale(colors.Success, _isDark);
		const warning = OklchColor.GenerateScale(colors.Warning, _isDark);
		const error = OklchColor.GenerateScale(colors.Error, _isDark);
		const info = OklchColor.GenerateScale(colors.Info, _isDark);
		const interactive = OklchColor.GenerateScale(colors.Interactive, _isDark);
		const amber = OklchColor.GenerateScale(
			OklchColor.Shift(colors.Warning, _isDark ? { H: -16, L: -0.058, C: 1.14 } : { H: -22, L: -0.082, C: 0.94 }),
			_isDark);
		const blue = OklchColor.GenerateScale(OklchColor.Shift(colors.Interactive, { H: -12, L: 0.128, C: 1.12 }), _isDark);
		const diffAdd = OklchColor.GenerateScale(
			colors.DiffAdd ?? OklchColor.Shift(colors.Success, { C: _isDark ? 0.7 : 0.55, L: _isDark ? -0.18 : 0.14 }),
			_isDark);
		const diffDelete = OklchColor.GenerateScale(
			colors.DiffDelete ?? OklchColor.Shift(colors.Error, { C: _isDark ? 0.82 : 0.7, L: _isDark ? -0.08 : 0.08 }),
			_isDark);
		const ink = colors.Ink ?? colors.Neutral;
		const tint = colors.Compact ? OklchColor.HexToOklch(ink) : null;
		const body = tint !== null
			? OklchColor.Shift(ink, {
				L: _isDark ? Math.max(0, 0.88 - tint.L) * 0.4 : -Math.max(0, tint.L - 0.18) * 0.24,
				C: _isDark ? 1.04 : 1.02,
			})
			: null;
		const backgroundOverride = overrides["background-base"];
		const backgroundHex = DesktopResolver.GetHex(backgroundOverride);
		const overlay = backgroundOverride !== undefined && backgroundHex === null;
		const background = backgroundHex ?? DesktopResolver.At(neutral, 0);
		const alphaTone = (_color: string, _alpha: number): string =>
			overlay ? OklchColor.WithAlpha(_color, _alpha) : OklchColor.Blend(_color, background, _alpha);
		const borderTone = (_light: number, _dark: number): string =>
			alphaTone(ink, _isDark ? Math.min(1, _dark + 0.024 + (colors.Compact ? 0.08 : 0)) : Math.min(1, _light + 0.024));
		const tokens: Record<string, string> = {};
		DesktopResolver.FillBase(tokens, neutral, _isDark);
		DesktopResolver.FillBrand(tokens, primary, interactive, success, warning, error, info, _isDark);
		DesktopResolver.FillDiff(tokens, neutral, diffAdd, diffDelete, colors, _isDark, alphaTone);
		DesktopResolver.FillInput(tokens, neutral, interactive, _isDark);
		DesktopResolver.FillText(tokens, neutral, primary, interactive, diffAdd, diffDelete, colors, body, _isDark);
		DesktopResolver.FillButton(tokens, neutral, _isDark);
		DesktopResolver.FillBorder(tokens, neutral, interactive, success, warning, error, info, colors, _isDark, borderTone);
		DesktopResolver.FillIcon(tokens, neutral, primary, interactive, success, warning, error, info, amber, blue, diffAdd, diffDelete, colors, _isDark);
		DesktopResolver.FillSyntax(tokens, primary, accent, interactive, success, warning, error, amber, info, diffAdd, diffDelete, colors, _isDark);
		DesktopResolver.FillAvatar(tokens, _isDark);
		for (const [key, value] of Object.entries(overrides))
			tokens[key] = DesktopResolver.NormalizeHex(value);
		if (colors.Compact && overrides["text-weak"] !== undefined && overrides["text-weaker"] === undefined)
		{
			const weak = DesktopResolver.Get(tokens, "text-weak");
			tokens["text-weaker"] = weak.startsWith("#")
				? OklchColor.Shift(weak, { L: _isDark ? -0.12 : 0.12, C: 0.75 })
				: weak;
		}
		if (colors.Compact)
		{
			if (overrides["markdown-text"] === undefined)
				tokens["markdown-text"] = DesktopResolver.Get(tokens, "text-base");
			if (overrides["markdown-code-block"] === undefined)
				tokens["markdown-code-block"] = DesktopResolver.Get(tokens, "text-base");
		}
		if (overrides["text-stronger"] === undefined)
			tokens["text-stronger"] = DesktopResolver.Get(tokens, "text-strong");
		const brandMid = (_scale: string[]): string => DesktopResolver.At(_scale, 5);
		tokens["primary-base"] = brandMid(primary);
		tokens["success-base"] = brandMid(success);
		tokens["warning-base"] = brandMid(warning);
		tokens["error-base"] = DesktopResolver.Get(tokens, "surface-critical-base");
		tokens["info-base"] = brandMid(info);
		tokens["text-invert"] = DesktopResolver.Get(tokens, "text-invert-base");
		tokens["syntax-function"] = DesktopResolver.Get(tokens, "syntax-keyword");
		tokens["syntax-number"] = DesktopResolver.Get(tokens, "syntax-primitive");
		return tokens;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰 맵을 CSS 변수 문자열로 바꾼다.
	// @param _tokens: 토큰 맵
	public static ToCss(_tokens: Record<string, string>): string
	{
		return Object.entries(_tokens)
			.map(([_key, _value]) => `--${_key}: ${_value};`)
			.join("\n  ");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 변형에서 색 묶음을 굳힌다. palette·seeds 중복이면 throw.
	// @param _variant: 변형
	private static GetColors(_variant: IDesktopVariant): IThemeColors
	{
		const palette = _variant.Palette;
		const seeds = _variant.Seeds;
		if (palette !== undefined && seeds !== undefined)
			throw new Error("[DesktopResolver] palette·seeds 중복");
		if (palette !== undefined)
			return DesktopResolver.FromPalette(palette);
		if (seeds !== undefined)
			return DesktopResolver.FromSeeds(seeds);
		throw new Error("[DesktopResolver] palette·seeds 없음");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 팔레트 변형을 색 묶음으로 바꾼다.
	// @param _palette: 팔레트
	private static FromPalette(_palette: IThemePaletteColors): IThemeColors
	{
		const colors: IThemeColors = {
			Compact: true,
			Neutral: _palette.Neutral,
			Ink: _palette.Ink,
			Primary: _palette.Primary,
			Accent: _palette.Accent ?? _palette.Info,
			Success: _palette.Success,
			Warning: _palette.Warning,
			Error: _palette.Error,
			Info: _palette.Info,
			Interactive: _palette.Interactive ?? _palette.Primary,
		};
		if (_palette.DiffAdd !== undefined)
			colors.DiffAdd = _palette.DiffAdd;
		if (_palette.DiffDelete !== undefined)
			colors.DiffDelete = _palette.DiffDelete;
		return colors;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 시드 변형을 색 묶음으로 바꾼다.
	// @param _seeds: 시드
	private static FromSeeds(_seeds: IThemeSeedColors): IThemeColors
	{
		const colors: IThemeColors = {
			Compact: false,
			Neutral: _seeds.Neutral,
			Primary: _seeds.Primary,
			Accent: _seeds.Info,
			Success: _seeds.Success,
			Warning: _seeds.Warning,
			Error: _seeds.Error,
			Info: _seeds.Info,
			Interactive: _seeds.Interactive,
		};
		if (_seeds.DiffAdd !== undefined)
			colors.DiffAdd = _seeds.DiffAdd;
		if (_seeds.DiffDelete !== undefined)
			colors.DiffDelete = _seeds.DiffDelete;
		return colors;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 배경·표면 토큰을 채운다.
	private static FillBase(
		_tokens: Record<string, string>,
		_neutral: string[],
		_isDark: boolean): void
	{
		const neutralAlpha = DesktopResolver.NeutralAlpha(_neutral, _isDark);
		_tokens["background-base"] = _isDark ? DesktopResolver.At(_neutral, 0) : DesktopResolver.At(_neutral, 2);
		_tokens["background-weak"] = DesktopResolver.At(_neutral, 2);
		_tokens["background-strong"] = DesktopResolver.At(_neutral, 0);
		_tokens["background-stronger"] = _isDark ? DesktopResolver.At(_neutral, 1) : "#fcfcfc";
		_tokens["surface-base"] = DesktopResolver.At(neutralAlpha, 1);
		_tokens["base"] = DesktopResolver.At(neutralAlpha, 1);
		// Light 조작 단계(base < hover < 버튼 < 버튼호버 < 누름). Dark는 기존 값을 유지한다.
		_tokens["surface-base-hover"] = _isDark ? DesktopResolver.At(neutralAlpha, 2) : DesktopResolver.At(neutralAlpha, 3);
		_tokens["surface-base-active"] = _isDark ? DesktopResolver.At(neutralAlpha, 2) : DesktopResolver.At(neutralAlpha, 6);
		_tokens["base2"] = DesktopResolver.At(neutralAlpha, 1);
		_tokens["base3"] = DesktopResolver.At(neutralAlpha, 1);
		_tokens["surface-inset-base"] = DesktopResolver.At(neutralAlpha, 1);
		_tokens["surface-inset-base-hover"] = DesktopResolver.At(neutralAlpha, 2);
		_tokens["surface-inset-strong"] = _isDark
			? OklchColor.WithAlpha(DesktopResolver.At(_neutral, 0), 0.5)
			: OklchColor.WithAlpha(DesktopResolver.At(_neutral, 3), 0.09);
		_tokens["surface-inset-strong-hover"] = DesktopResolver.Get(_tokens, "surface-inset-strong");
		_tokens["surface-raised-base"] = DesktopResolver.At(neutralAlpha, 0);
		_tokens["surface-float-base"] = DesktopResolver.At(_neutral, 1);
		_tokens["surface-float-base-hover"] = _isDark ? DesktopResolver.At(_neutral, 2) : DesktopResolver.At(_neutral, 1);
		_tokens["surface-raised-base-hover"] = DesktopResolver.At(neutralAlpha, 1);
		_tokens["surface-raised-base-active"] = DesktopResolver.At(neutralAlpha, 2);
		_tokens["surface-raised-strong"] = _isDark ? DesktopResolver.At(neutralAlpha, 3) : DesktopResolver.At(neutralAlpha, 4);
		_tokens["surface-raised-strong-hover"] = DesktopResolver.At(neutralAlpha, 5);
		_tokens["surface-raised-stronger"] = _isDark ? DesktopResolver.At(neutralAlpha, 5) : "#ffffff";
		_tokens["surface-raised-stronger-hover"] = _isDark ? DesktopResolver.At(neutralAlpha, 6) : "#ffffff";
		_tokens["surface-weak"] = DesktopResolver.At(neutralAlpha, 2);
		_tokens["surface-weaker"] = DesktopResolver.At(neutralAlpha, 3);
		_tokens["surface-strong"] = _isDark ? DesktopResolver.At(neutralAlpha, 6) : "#ffffff";
		_tokens["surface-raised-stronger-non-alpha"] = _isDark ? DesktopResolver.At(_neutral, 2) : "#ffffff";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 브랜드·상태 표면 토큰을 채운다.
	private static FillBrand(
		_tokens: Record<string, string>,
		_primary: string[],
		_interactive: string[],
		_success: string[],
		_warning: string[],
		_error: string[],
		_info: string[],
		_isDark: boolean): void
	{
		_tokens["surface-brand-base"] = DesktopResolver.At(_primary, 8);
		_tokens["surface-brand-hover"] = DesktopResolver.At(_primary, 9);
		_tokens["surface-interactive-base"] = DesktopResolver.At(_interactive, _isDark ? 6 : 4);
		_tokens["surface-interactive-hover"] = DesktopResolver.At(_interactive, _isDark ? 7 : 5);
		_tokens["surface-interactive-weak"] = DesktopResolver.At(_interactive, _isDark ? 5 : 3);
		_tokens["surface-interactive-weak-hover"] = DesktopResolver.At(_interactive, _isDark ? 6 : 4);
		_tokens["surface-success-base"] = DesktopResolver.At(_success, _isDark ? 6 : 4);
		_tokens["surface-success-weak"] = DesktopResolver.At(_success, _isDark ? 5 : 3);
		_tokens["surface-success-strong"] = DesktopResolver.At(_success, 10);
		_tokens["surface-warning-base"] = DesktopResolver.At(_warning, _isDark ? 6 : 4);
		_tokens["surface-warning-weak"] = DesktopResolver.At(_warning, _isDark ? 5 : 3);
		_tokens["surface-warning-strong"] = DesktopResolver.At(_warning, 10);
		_tokens["surface-critical-base"] = DesktopResolver.At(_error, _isDark ? 6 : 4);
		_tokens["surface-critical-weak"] = DesktopResolver.At(_error, _isDark ? 5 : 3);
		_tokens["surface-critical-strong"] = DesktopResolver.At(_error, 10);
		_tokens["surface-info-base"] = DesktopResolver.At(_info, _isDark ? 6 : 4);
		_tokens["surface-info-weak"] = DesktopResolver.At(_info, _isDark ? 5 : 3);
		_tokens["surface-info-strong"] = DesktopResolver.At(_info, 10);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// diff 표면 토큰을 채운다.
	private static FillDiff(
		_tokens: Record<string, string>,
		_neutral: string[],
		_diffAdd: string[],
		_diffDelete: string[],
		_colors: IThemeColors,
		_isDark: boolean,
		_alphaTone: (_color: string, _alpha: number) => string): void
	{
		const neutralAlpha = DesktopResolver.NeutralAlpha(_neutral, _isDark);
		const hiddenSeed = _isDark
			? OklchColor.Shift(_colors.Interactive, { C: 0.55, L: 0 })
			: OklchColor.Shift(_colors.Interactive, { C: 0.45, L: 0.08 });
		const hiddenAlpha = _isDark
			? { Base: 0.14, Weak: 0.08, Weaker: 0.18, Strong: 0.26, Stronger: 0.42 }
			: { Base: 0.12, Weak: 0.08, Weaker: 0.16, Strong: 0.24, Stronger: 0.36 };
		_tokens["surface-diff-unchanged-base"] = _isDark ? DesktopResolver.At(_neutral, 0) : "#ffffff00";
		_tokens["surface-diff-skip-base"] = _isDark ? DesktopResolver.At(neutralAlpha, 0) : DesktopResolver.At(_neutral, 1);
		_tokens["surface-diff-hidden-base"] = _alphaTone(hiddenSeed, hiddenAlpha.Base);
		_tokens["surface-diff-hidden-weak"] = _alphaTone(hiddenSeed, hiddenAlpha.Weak);
		_tokens["surface-diff-hidden-weaker"] = _alphaTone(hiddenSeed, hiddenAlpha.Weaker);
		_tokens["surface-diff-hidden-strong"] = _alphaTone(hiddenSeed, hiddenAlpha.Strong);
		_tokens["surface-diff-hidden-stronger"] = _alphaTone(hiddenSeed, hiddenAlpha.Stronger);
		_tokens["surface-diff-add-base"] = DesktopResolver.At(_diffAdd, 2);
		_tokens["surface-diff-add-weak"] = DesktopResolver.At(_diffAdd, _isDark ? 3 : 1);
		_tokens["surface-diff-add-weaker"] = DesktopResolver.At(_diffAdd, _isDark ? 2 : 0);
		_tokens["surface-diff-add-strong"] = DesktopResolver.At(_diffAdd, 4);
		_tokens["surface-diff-add-stronger"] = DesktopResolver.At(_diffAdd, _isDark ? 10 : 8);
		_tokens["surface-diff-delete-base"] = DesktopResolver.At(_diffDelete, 2);
		_tokens["surface-diff-delete-weak"] = DesktopResolver.At(_diffDelete, _isDark ? 3 : 1);
		_tokens["surface-diff-delete-weaker"] = DesktopResolver.At(_diffDelete, _isDark ? 2 : 0);
		_tokens["surface-diff-delete-strong"] = DesktopResolver.At(_diffDelete, _isDark ? 4 : 5);
		_tokens["surface-diff-delete-stronger"] = DesktopResolver.At(_diffDelete, _isDark ? 10 : 8);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 입력 토큰을 채운다.
	private static FillInput(
		_tokens: Record<string, string>,
		_neutral: string[],
		_interactive: string[],
		_isDark: boolean): void
	{
		_tokens["input-base"] = _isDark ? DesktopResolver.At(_neutral, 1) : "#ffffff";
		_tokens["input-hover"] = _isDark ? DesktopResolver.At(_neutral, 2) : DesktopResolver.At(_neutral, 1);
		_tokens["input-active"] = DesktopResolver.At(_interactive, _isDark ? 6 : 0);
		_tokens["input-selected"] = DesktopResolver.At(_interactive, _isDark ? 7 : 3);
		_tokens["input-focus"] = DesktopResolver.At(_interactive, _isDark ? 6 : 0);
		_tokens["input-disabled"] = DesktopResolver.At(_neutral, 3);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트 토큰을 채운다.
	private static FillText(
		_tokens: Record<string, string>,
		_neutral: string[],
		_primary: string[],
		_interactive: string[],
		_diffAdd: string[],
		_diffDelete: string[],
		_colors: IThemeColors,
		_body: string | null,
		_isDark: boolean): void
	{
		const on = (_fill: string): string => DesktopResolver.On(_fill);
		const brandb = DesktopResolver.At(_primary, 8);
		const brandh = DesktopResolver.At(_primary, 9);
		const interb = DesktopResolver.At(_interactive, _isDark ? 6 : 4);
		_tokens["text-base"] = _colors.Compact && _body !== null ? _body : DesktopResolver.At(_neutral, 10);
		_tokens["text-weak"] = _colors.Compact && _body !== null
			? OklchColor.Shift(_body, { L: _isDark ? -0.11 : 0.11, C: 0.9 })
			: DesktopResolver.At(_neutral, 8);
		_tokens["text-weaker"] = _colors.Compact && _body !== null
			? OklchColor.Shift(_body, { L: _isDark ? -0.2 : 0.21, C: _isDark ? 0.78 : 0.72 })
			: DesktopResolver.At(_neutral, 7);
		_tokens["text-strong"] = _colors.Compact && _body !== null
			? _isDark ? OklchColor.Blend("#ffffff", _body, 0.9) : OklchColor.Shift(_body, { L: -0.07, C: 1.04 })
			: DesktopResolver.At(_neutral, 11);
		_tokens["text-invert-base"] = _isDark ? DesktopResolver.At(_neutral, 10) : DesktopResolver.At(_neutral, 1);
		_tokens["text-invert-weak"] = _isDark ? DesktopResolver.At(_neutral, 8) : DesktopResolver.At(_neutral, 2);
		_tokens["text-invert-weaker"] = _isDark ? DesktopResolver.At(_neutral, 7) : DesktopResolver.At(_neutral, 3);
		_tokens["text-invert-strong"] = _isDark ? DesktopResolver.At(_neutral, 11) : DesktopResolver.At(_neutral, 0);
		_tokens["text-interactive-base"] = DesktopResolver.At(_interactive, _isDark ? 10 : 9);
		_tokens["text-on-brand-base"] = on(brandb);
		_tokens["text-on-interactive-base"] = on(interb);
		_tokens["text-on-interactive-weak"] = on(interb);
		_tokens["text-on-success-base"] = on(DesktopResolver.Get(_tokens, "surface-success-base"));
		_tokens["text-on-critical-base"] = on(DesktopResolver.Get(_tokens, "surface-critical-base"));
		_tokens["text-on-critical-weak"] = on(DesktopResolver.Get(_tokens, "surface-critical-base"));
		_tokens["text-on-critical-strong"] = on(DesktopResolver.Get(_tokens, "surface-critical-strong"));
		_tokens["text-on-warning-base"] = on(DesktopResolver.Get(_tokens, "surface-warning-base"));
		_tokens["text-on-info-base"] = on(DesktopResolver.Get(_tokens, "surface-info-base"));
		_tokens["text-diff-add-base"] = DesktopResolver.At(_diffAdd, 10);
		_tokens["text-diff-delete-base"] = DesktopResolver.At(_diffDelete, 9);
		_tokens["text-diff-delete-strong"] = DesktopResolver.At(_diffDelete, 11);
		_tokens["text-diff-add-strong"] = DesktopResolver.At(_diffAdd, _isDark ? 7 : 11);
		_tokens["text-on-info-weak"] = on(DesktopResolver.Get(_tokens, "surface-info-base"));
		_tokens["text-on-info-strong"] = on(DesktopResolver.Get(_tokens, "surface-info-strong"));
		_tokens["text-on-warning-weak"] = on(DesktopResolver.Get(_tokens, "surface-warning-base"));
		_tokens["text-on-warning-strong"] = on(DesktopResolver.Get(_tokens, "surface-warning-strong"));
		_tokens["text-on-success-weak"] = on(DesktopResolver.Get(_tokens, "surface-success-base"));
		_tokens["text-on-success-strong"] = on(DesktopResolver.Get(_tokens, "surface-success-strong"));
		_tokens["text-on-brand-weak"] = on(brandb);
		_tokens["text-on-brand-weaker"] = on(brandb);
		_tokens["text-on-brand-strong"] = on(brandh);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 버튼 토큰을 채운다.
	private static FillButton(
		_tokens: Record<string, string>,
		_neutral: string[],
		_isDark: boolean): void
	{
		const neutralAlpha = DesktopResolver.NeutralAlpha(_neutral, _isDark);
		_tokens["button-primary-base"] = DesktopResolver.At(_neutral, 11);
		_tokens["button-secondary-base"] = _isDark ? DesktopResolver.At(_neutral, 2) : DesktopResolver.At(_neutral, 0);
		_tokens["button-secondary-hover"] = _isDark ? DesktopResolver.At(_neutral, 3) : DesktopResolver.At(_neutral, 1);
		_tokens["button-ghost-hover"] = DesktopResolver.At(neutralAlpha, 1);
		_tokens["button-ghost-hover2"] = DesktopResolver.At(neutralAlpha, 2);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테두리 토큰을 채운다.
	private static FillBorder(
		_tokens: Record<string, string>,
		_neutral: string[],
		_interactive: string[],
		_success: string[],
		_warning: string[],
		_error: string[],
		_info: string[],
		_colors: IThemeColors,
		_isDark: boolean,
		_borderTone: (_light: number, _dark: number) => string): void
	{
		const neutralAlpha = DesktopResolver.NeutralAlpha(_neutral, _isDark);
		_tokens["border-base"] = _colors.Compact ? _borderTone(0.22, 0.16) : DesktopResolver.At(neutralAlpha, 6);
		_tokens["border-hover"] = _colors.Compact ? _borderTone(0.28, 0.2) : DesktopResolver.At(neutralAlpha, 7);
		_tokens["border-active"] = _colors.Compact ? _borderTone(0.34, 0.24) : DesktopResolver.At(neutralAlpha, 8);
		_tokens["border-selected"] = OklchColor.WithAlpha(DesktopResolver.At(_interactive, 8), _isDark ? 0.9 : 0.99);
		_tokens["border-disabled"] = _colors.Compact ? _borderTone(0.18, 0.12) : DesktopResolver.At(neutralAlpha, 7);
		_tokens["border-focus"] = _colors.Compact ? _borderTone(0.34, 0.24) : DesktopResolver.At(neutralAlpha, 8);
		_tokens["border-weak-base"] = _colors.Compact ? _borderTone(0.1, 0.08) : DesktopResolver.At(neutralAlpha, _isDark ? 5 : 4);
		_tokens["border-strong-base"] = _colors.Compact ? _borderTone(0.34, 0.24) : DesktopResolver.At(neutralAlpha, _isDark ? 7 : 6);
		_tokens["border-strong-hover"] = _colors.Compact ? _borderTone(0.4, 0.28) : DesktopResolver.At(neutralAlpha, 7);
		_tokens["border-strong-active"] = _colors.Compact ? _borderTone(0.46, 0.32) : DesktopResolver.At(neutralAlpha, _isDark ? 7 : 6);
		_tokens["border-strong-selected"] = OklchColor.WithAlpha(DesktopResolver.At(_interactive, 5), 0.6);
		_tokens["border-strong-disabled"] = _colors.Compact ? _borderTone(0.14, 0.1) : DesktopResolver.At(neutralAlpha, 5);
		_tokens["border-strong-focus"] = _colors.Compact ? _borderTone(0.46, 0.32) : DesktopResolver.At(neutralAlpha, _isDark ? 7 : 6);
		_tokens["border-weak-hover"] = _colors.Compact ? _borderTone(0.16, 0.12) : DesktopResolver.At(neutralAlpha, _isDark ? 6 : 5);
		_tokens["border-weak-active"] = _colors.Compact ? _borderTone(0.22, 0.16) : DesktopResolver.At(neutralAlpha, _isDark ? 7 : 6);
		_tokens["border-weak-selected"] = OklchColor.WithAlpha(DesktopResolver.At(_interactive, 4), _isDark ? 0.6 : 0.5);
		_tokens["border-weak-disabled"] = _colors.Compact ? _borderTone(0.08, 0.06) : DesktopResolver.At(neutralAlpha, 6);
		_tokens["border-weak-focus"] = _colors.Compact ? _borderTone(0.22, 0.16) : DesktopResolver.At(neutralAlpha, _isDark ? 7 : 6);
		_tokens["border-weaker-base"] = _colors.Compact ? _borderTone(0.06, 0.04) : DesktopResolver.At(neutralAlpha, 2);
		_tokens["border-interactive-base"] = DesktopResolver.At(_interactive, 6);
		_tokens["border-interactive-hover"] = DesktopResolver.At(_interactive, 7);
		_tokens["border-interactive-active"] = DesktopResolver.At(_interactive, 8);
		_tokens["border-interactive-selected"] = DesktopResolver.At(_interactive, 8);
		_tokens["border-interactive-disabled"] = DesktopResolver.At(_neutral, 7);
		_tokens["border-interactive-focus"] = DesktopResolver.At(_interactive, 8);
		_tokens["border-success-base"] = DesktopResolver.At(_success, 6);
		_tokens["border-success-hover"] = DesktopResolver.At(_success, 7);
		_tokens["border-success-selected"] = DesktopResolver.At(_success, 8);
		_tokens["border-warning-base"] = DesktopResolver.At(_warning, 6);
		_tokens["border-warning-hover"] = DesktopResolver.At(_warning, 7);
		_tokens["border-warning-selected"] = DesktopResolver.At(_warning, 8);
		_tokens["border-critical-base"] = DesktopResolver.At(_error, 6);
		_tokens["border-critical-hover"] = DesktopResolver.At(_error, 7);
		_tokens["border-critical-selected"] = DesktopResolver.At(_error, 8);
		_tokens["border-info-base"] = DesktopResolver.At(_info, 6);
		_tokens["border-info-hover"] = DesktopResolver.At(_info, 7);
		_tokens["border-info-selected"] = DesktopResolver.At(_info, 8);
		_tokens["border-color"] = "#ffffff";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 아이콘 토큰을 채운다.
	private static FillIcon(
		_tokens: Record<string, string>,
		_neutral: string[],
		_primary: string[],
		_interactive: string[],
		_success: string[],
		_warning: string[],
		_error: string[],
		_info: string[],
		_amber: string[],
		_blue: string[],
		_diffAdd: string[],
		_diffDelete: string[],
		_colors: IThemeColors,
		_isDark: boolean): void
	{
		const on = (_fill: string): string => DesktopResolver.On(_fill);
		const textWeak = DesktopResolver.Get(_tokens, "text-weak");
		const textBase = DesktopResolver.Get(_tokens, "text-base");
		const textStrong = DesktopResolver.Get(_tokens, "text-strong");
		const brandb = DesktopResolver.At(_primary, 8);
		const brandh = DesktopResolver.At(_primary, 9);
		const interb = DesktopResolver.At(_interactive, _isDark ? 6 : 4);
		_tokens["icon-base"] = _colors.Compact && !_isDark ? textWeak : DesktopResolver.At(_neutral, _isDark ? 9 : 8);
		_tokens["icon-hover"] = _colors.Compact && !_isDark ? textBase : DesktopResolver.At(_neutral, 10);
		_tokens["icon-active"] = _colors.Compact && !_isDark ? textStrong : DesktopResolver.At(_neutral, 11);
		_tokens["icon-selected"] = _colors.Compact && !_isDark ? textStrong : DesktopResolver.At(_neutral, 11);
		_tokens["icon-disabled"] = DesktopResolver.At(_neutral, _isDark ? 6 : 7);
		_tokens["icon-focus"] = _colors.Compact && !_isDark ? textStrong : DesktopResolver.At(_neutral, 11);
		_tokens["icon-invert-base"] = _isDark ? DesktopResolver.At(_neutral, 0) : "#ffffff";
		_tokens["icon-weak-base"] = DesktopResolver.At(_neutral, _isDark ? 5 : 6);
		_tokens["icon-weak-hover"] = DesktopResolver.At(_neutral, _isDark ? 11 : 7);
		_tokens["icon-weak-active"] = DesktopResolver.At(_neutral, 8);
		_tokens["icon-weak-selected"] = DesktopResolver.At(_neutral, _isDark ? 8 : 9);
		_tokens["icon-weak-disabled"] = DesktopResolver.At(_neutral, _isDark ? 3 : 5);
		_tokens["icon-weak-focus"] = DesktopResolver.At(_neutral, 8);
		_tokens["icon-strong-base"] = DesktopResolver.At(_neutral, 11);
		_tokens["icon-strong-hover"] = _isDark ? "#f6f3f3" : "#151313";
		_tokens["icon-strong-active"] = _isDark ? "#fcfcfc" : "#020202";
		_tokens["icon-strong-selected"] = _isDark ? "#fdfcfc" : "#020202";
		_tokens["icon-strong-disabled"] = DesktopResolver.At(_neutral, 7);
		_tokens["icon-strong-focus"] = _isDark ? "#fdfcfc" : "#020202";
		_tokens["icon-brand-base"] = _isDark ? "#ffffff" : DesktopResolver.At(_neutral, 11);
		_tokens["icon-interactive-base"] = DesktopResolver.At(_interactive, 8);
		_tokens["icon-success-base"] = DesktopResolver.At(_success, _isDark ? 8 : 6);
		_tokens["icon-success-hover"] = DesktopResolver.At(_success, 9);
		_tokens["icon-success-active"] = DesktopResolver.At(_success, 10);
		_tokens["icon-warning-base"] = DesktopResolver.At(_amber, _isDark ? 8 : 6);
		_tokens["icon-warning-hover"] = DesktopResolver.At(_amber, 9);
		_tokens["icon-warning-active"] = DesktopResolver.At(_amber, 10);
		_tokens["icon-critical-base"] = DesktopResolver.At(_error, _isDark ? 8 : 9);
		_tokens["icon-critical-hover"] = DesktopResolver.At(_error, 9);
		_tokens["icon-critical-active"] = DesktopResolver.At(_error, 10);
		_tokens["icon-info-base"] = DesktopResolver.At(_info, _isDark ? 8 : 6);
		_tokens["icon-info-hover"] = DesktopResolver.At(_info, _isDark ? 9 : 7);
		_tokens["icon-info-active"] = DesktopResolver.At(_info, 10);
		_tokens["icon-on-brand-base"] = on(brandb);
		_tokens["icon-on-brand-hover"] = on(brandh);
		_tokens["icon-on-brand-selected"] = on(brandh);
		_tokens["icon-on-interactive-base"] = on(interb);
		_tokens["icon-agent-plan-base"] = DesktopResolver.At(_info, 8);
		_tokens["icon-agent-docs-base"] = DesktopResolver.At(_amber, 8);
		_tokens["icon-agent-build-base"] = DesktopResolver.At(_interactive, _isDark ? 10 : 8);
		_tokens["icon-agent-ask-base"] = DesktopResolver.At(_blue, 8);
		_tokens["icon-on-success-base"] = on(DesktopResolver.Get(_tokens, "surface-success-base"));
		_tokens["icon-on-success-hover"] = on(DesktopResolver.Get(_tokens, "surface-success-strong"));
		_tokens["icon-on-success-selected"] = on(DesktopResolver.Get(_tokens, "surface-success-strong"));
		_tokens["icon-on-warning-base"] = on(DesktopResolver.Get(_tokens, "surface-warning-base"));
		_tokens["icon-on-warning-hover"] = on(DesktopResolver.Get(_tokens, "surface-warning-strong"));
		_tokens["icon-on-warning-selected"] = on(DesktopResolver.Get(_tokens, "surface-warning-strong"));
		_tokens["icon-on-critical-base"] = on(DesktopResolver.Get(_tokens, "surface-critical-base"));
		_tokens["icon-on-critical-hover"] = on(DesktopResolver.Get(_tokens, "surface-critical-strong"));
		_tokens["icon-on-critical-selected"] = on(DesktopResolver.Get(_tokens, "surface-critical-strong"));
		_tokens["icon-on-info-base"] = on(DesktopResolver.Get(_tokens, "surface-info-base"));
		_tokens["icon-on-info-hover"] = on(DesktopResolver.Get(_tokens, "surface-info-strong"));
		_tokens["icon-on-info-selected"] = on(DesktopResolver.Get(_tokens, "surface-info-strong"));
		_tokens["icon-diff-add-base"] = DesktopResolver.At(_diffAdd, 10);
		_tokens["icon-diff-add-hover"] = DesktopResolver.At(_diffAdd, _isDark ? 9 : 11);
		_tokens["icon-diff-add-active"] = DesktopResolver.At(_diffAdd, _isDark ? 10 : 11);
		_tokens["icon-diff-delete-base"] = DesktopResolver.At(_diffDelete, 9);
		_tokens["icon-diff-delete-hover"] = DesktopResolver.At(_diffDelete, 10);
		_tokens["icon-diff-modified-base"] = DesktopResolver.Modified(_colors, _warning, _diffDelete, _isDark);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 구문·마크다운·아바타 토큰을 채운다.
	private static FillSyntax(
		_tokens: Record<string, string>,
		_primary: string[],
		_accent: string[],
		_interactive: string[],
		_success: string[],
		_warning: string[],
		_error: string[],
		_amber: string[],
		_info: string[],
		_diffAdd: string[],
		_diffDelete: string[],
		_colors: IThemeColors,
		_isDark: boolean): void
	{
		const content = (_seed: string, _scale: string[]): string => DesktopResolver.Content(_seed, _scale, _isDark);
		if (_colors.Compact)
		{
			_tokens["syntax-comment"] = "var(--text-weak)";
			_tokens["syntax-regexp"] = "var(--text-base)";
			_tokens["syntax-string"] = content(_colors.Success, _success);
			_tokens["syntax-keyword"] = content(_colors.Accent, _accent);
			_tokens["syntax-primitive"] = content(_colors.Primary, _primary);
			_tokens["syntax-operator"] = _isDark ? "var(--text-weak)" : "var(--text-base)";
			_tokens["syntax-variable"] = "var(--text-strong)";
			_tokens["syntax-property"] = content(_colors.Info, _info);
			_tokens["syntax-type"] = content(_colors.Warning, _warning);
			_tokens["syntax-constant"] = content(_colors.Accent, _accent);
			_tokens["syntax-punctuation"] = _isDark ? "var(--text-weak)" : "var(--text-base)";
			_tokens["syntax-object"] = "var(--text-strong)";
			_tokens["syntax-success"] = DesktopResolver.At(_success, 10);
			_tokens["syntax-warning"] = DesktopResolver.At(_amber, 10);
			_tokens["syntax-critical"] = DesktopResolver.At(_error, 10);
			_tokens["syntax-info"] = content(_colors.Info, _info);
			_tokens["syntax-diff-add"] = DesktopResolver.At(_diffAdd, 10);
			_tokens["syntax-diff-delete"] = DesktopResolver.At(_diffDelete, 10);
			_tokens["syntax-diff-unknown"] = "#ff0000";
			_tokens["markdown-heading"] = content(_colors.Primary, _primary);
			_tokens["markdown-text"] = DesktopResolver.Get(_tokens, "text-base");
			_tokens["markdown-link"] = content(_colors.Interactive, _interactive);
			_tokens["markdown-link-text"] = content(_colors.Info, _info);
			_tokens["markdown-code"] = content(_colors.Success, _success);
			_tokens["markdown-block-quote"] = content(_colors.Warning, _warning);
			_tokens["markdown-emph"] = content(_colors.Warning, _warning);
			_tokens["markdown-strong"] = content(_colors.Accent, _accent);
			_tokens["markdown-horizontal-rule"] = DesktopResolver.Get(_tokens, "border-base");
			_tokens["markdown-list-item"] = content(_colors.Interactive, _interactive);
			_tokens["markdown-list-enumeration"] = content(_colors.Info, _info);
			_tokens["markdown-image"] = content(_colors.Interactive, _interactive);
			_tokens["markdown-image-text"] = content(_colors.Info, _info);
			_tokens["markdown-code-block"] = DesktopResolver.Get(_tokens, "text-base");
			return;
		}
		_tokens["syntax-comment"] = "var(--text-weak)";
		_tokens["syntax-regexp"] = "var(--text-base)";
		_tokens["syntax-string"] = _isDark ? "#00ceb9" : "#006656";
		_tokens["syntax-keyword"] = "var(--text-weak)";
		_tokens["syntax-primitive"] = _isDark ? "#ffba92" : "#fb4804";
		_tokens["syntax-operator"] = _isDark ? "var(--text-weak)" : "var(--text-base)";
		_tokens["syntax-variable"] = "var(--text-strong)";
		_tokens["syntax-property"] = _isDark ? "#ff9ae2" : "#ed6dc8";
		_tokens["syntax-type"] = _isDark ? "#ecf58c" : "#596600";
		_tokens["syntax-constant"] = _isDark ? "#93e9f6" : "#007b80";
		_tokens["syntax-punctuation"] = _isDark ? "var(--text-weak)" : "var(--text-base)";
		_tokens["syntax-object"] = "var(--text-strong)";
		_tokens["syntax-success"] = DesktopResolver.At(_success, 10);
		_tokens["syntax-warning"] = DesktopResolver.At(_amber, 10);
		_tokens["syntax-critical"] = DesktopResolver.At(_error, 10);
		_tokens["syntax-info"] = _isDark ? "#93e9f6" : "#0092a8";
		_tokens["syntax-diff-add"] = DesktopResolver.At(_diffAdd, 10);
		_tokens["syntax-diff-delete"] = DesktopResolver.At(_diffDelete, 10);
		_tokens["syntax-diff-unknown"] = "#ff0000";
		_tokens["markdown-heading"] = _isDark ? "#9d7cd8" : "#d68c27";
		_tokens["markdown-text"] = _isDark ? "#eeeeee" : "#1a1a1a";
		_tokens["markdown-link"] = _isDark ? "#fab283" : "#3b7dd8";
		_tokens["markdown-link-text"] = _isDark ? "#56b6c2" : "#318795";
		_tokens["markdown-code"] = _isDark ? "#7fd88f" : "#3d9a57";
		_tokens["markdown-block-quote"] = _isDark ? "#e5c07b" : "#b0851f";
		_tokens["markdown-emph"] = _isDark ? "#e5c07b" : "#b0851f";
		_tokens["markdown-strong"] = _isDark ? "#f5a742" : "#d68c27";
		_tokens["markdown-horizontal-rule"] = _isDark ? "#808080" : "#8a8a8a";
		_tokens["markdown-list-item"] = _isDark ? "#fab283" : "#3b7dd8";
		_tokens["markdown-list-enumeration"] = _isDark ? "#56b6c2" : "#318795";
		_tokens["markdown-image"] = _isDark ? "#fab283" : "#3b7dd8";
		_tokens["markdown-image-text"] = _isDark ? "#56b6c2" : "#318795";
		_tokens["markdown-code-block"] = _isDark ? "#eeeeee" : "#1a1a1a";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 아바타 토큰을 채운다.
	// @param _tokens: 토큰 맵
	// @param _isDark: 다크 여부
	private static FillAvatar(_tokens: Record<string, string>, _isDark: boolean): void
	{
		_tokens["avatar-background-pink"] = _isDark ? "#501b3f" : "#feeef8";
		_tokens["avatar-background-mint"] = _isDark ? "#033a34" : "#e1fbf4";
		_tokens["avatar-background-orange"] = _isDark ? "#5f2a06" : "#fff1e7";
		_tokens["avatar-background-purple"] = _isDark ? "#432155" : "#f9f1fe";
		_tokens["avatar-background-cyan"] = _isDark ? "#0f3058" : "#e7f9fb";
		_tokens["avatar-background-lime"] = _isDark ? "#2b3711" : "#eefadc";
		_tokens["avatar-text-pink"] = _isDark ? "#e34ba9" : "#cd1d8d";
		_tokens["avatar-text-mint"] = _isDark ? "#95f3d9" : "#147d6f";
		_tokens["avatar-text-orange"] = _isDark ? "#ff802b" : "#ed5f00";
		_tokens["avatar-text-purple"] = _isDark ? "#9d5bd2" : "#8445bc";
		_tokens["avatar-text-cyan"] = _isDark ? "#369eff" : "#0894b3";
		_tokens["avatar-text-lime"] = _isDark ? "#c4f042" : "#5d770d";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 중립 알파 스케일을 만든다.
	// @param _neutral: 중립 스케일
	// @param _isDark: 다크 여부
	private static NeutralAlpha(_neutral: string[], _isDark: boolean): string[]
	{
		const alphas = _isDark
			? [0.038, 0.066, 0.1, 0.142, 0.19, 0.252, 0.334, 0.446, 0.58, 0.718, 0.854, 0.985]
			: [0.03, 0.06, 0.1, 0.145, 0.2, 0.265, 0.35, 0.47, 0.61, 0.74, 0.86, 0.97];
		return alphas.map((_alpha) => OklchColor.Blend(DesktopResolver.At(_neutral, 11), DesktopResolver.At(_neutral, 0), _alpha));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 오버라이드 hex를 굳힌다. # 없는 6자리는 보정한다.
	// @param _value: 원문 (생략 가능)
	private static GetHex(_value: string | undefined): string | null
	{
		if (_value === undefined || !_value.startsWith("#"))
			return null;
		return _value;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// # 없는 6자리 hex에 #를 붙인다.
	// @param _value: 원문
	private static NormalizeHex(_value: string): string
	{
		if (/^[0-9a-fA-F]{6}$/.exec(_value) !== null)
			return `#${_value}`;
		return _value;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 채움 위 검정·흰색 중 대비 높은 쪽을 고른다.
	// @param _fill: 채움색
	private static On(_fill: string): string
	{
		const lum = (_hex: string): number =>
		{
			const rgb = OklchColor.HexToRgb(_hex);
			const lift = (_v: number): number => _v <= 0.04045 ? _v / 12.92 : Math.pow((_v + 0.055) / 1.055, 2.4);
			return 0.2126 * lift(rgb.R) + 0.7152 * lift(rgb.G) + 0.0722 * lift(rgb.B);
		};
		if (!_fill.startsWith("#"))
			return "#ffffff";
		const light = lum("#ffffff");
		const dark = lum("#000000");
		const back = lum(_fill);
		const lightContrast = (Math.max(light, back) + 0.05) / (Math.min(light, back) + 0.05);
		const darkContrast = (Math.max(dark, back) + 0.05) / (Math.min(dark, back) + 0.05);
		return lightContrast > darkContrast ? "#ffffff" : "#000000";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 내용색을 구한다.
	// @param _seed: 시드
	// @param _scale: 스케일
	// @param _isDark: 다크 여부
	private static Content(_seed: string, _scale: string[], _isDark: boolean): string
	{
		const base = OklchColor.HexToOklch(_seed);
		const value = _isDark
			? (base.L > 0.84 ? OklchColor.Shift(_seed, { C: 1.18 }) : DesktopResolver.At(_scale, 10))
			: DesktopResolver.At(_scale, 10);
		return OklchColor.Shift(value, { L: _isDark ? 0.034 : -0.024, C: _isDark ? 1.3 : 1.18 });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 수정 표시색을 구한다.
	private static Modified(_colors: IThemeColors, _warning: string[], _diffDelete: string[], _isDark: boolean): string
	{
		if (!_colors.Compact)
			return _isDark ? "#ffba92" : "#FF8C00";
		const warningHue = OklchColor.HexToOklch(_colors.Warning).H;
		const fallbackDelete = _colors.DiffDelete ?? _colors.Error;
		const deleteHue = OklchColor.HexToOklch(fallbackDelete).H;
		const delta = Math.abs(((((deleteHue - warningHue) % 360) + 540) % 360) - 180);
		if (delta < 48)
			return _isDark ? "#ffba92" : "#FF8C00";
		return DesktopResolver.Content(_colors.Warning, _warning, _isDark);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스케일 인덱스를 굳힌다. 없으면 throw.
	// @param _scale: 스케일
	// @param _idx: 인덱스
	private static At(_scale: string[], _idx: number): string
	{
		const found = _scale[_idx];
		if (found === undefined)
			throw new Error(`[DesktopResolver] 인덱스 없음: ${_idx}`);
		return found;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 채운 토큰을 굳힌다. 없으면 throw.
	// @param _tokens: 토큰 맵
	// @param _key: 키
	private static Get(_tokens: Record<string, string>, _key: string): string
	{
		const found = _tokens[_key];
		if (found === undefined)
			throw new Error(`[DesktopResolver] 토큰 없음: ${_key}`);
		return found;
	}
}
