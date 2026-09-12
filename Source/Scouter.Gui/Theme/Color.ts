/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Color. hex 파싱·WCAG 대비·HSL 가감. 외부 색 라이브러리 없음.
*/

export interface IRgb
{
	R: number;
	G: number;
	B: number;
}

export class Color
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// #rgb/#rrggbb를 파싱한다. 실패하면 null.
	// @param _hex: 색 문자열
	public static Parse(_hex: string): IRgb | null
	{
		const text = _hex.trim();
		const short = /^#([0-9a-fA-F]{3})$/.exec(text);
		if (short !== null)
		{
			const digits = short[1] as string;
			const r = digits.charAt(0);
			const g = digits.charAt(1);
			const b = digits.charAt(2);
			return {
				R: Number.parseInt(r + r, 16),
				G: Number.parseInt(g + g, 16),
				B: Number.parseInt(b + b, 16),
			};
		}
		const full = /^#([0-9a-fA-F]{6})$/.exec(text);
		if (full !== null)
		{
			const digits = full[1] as string;
			return { R: Number.parseInt(digits.slice(0, 2), 16), G: Number.parseInt(digits.slice(2, 4), 16), B: Number.parseInt(digits.slice(4, 6), 16) };
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// hex 형식인지 본다.
	// @param _text: 문자열
	public static IsHex(_text: string): boolean
	{
		return Color.Parse(_text) !== null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// WCAG 대비율을 구한다.
	// @param _fg: 전경
	// @param _bg: 배경
	public static Contrast(_fg: IRgb, _bg: IRgb): number
	{
		const lum = (_c: IRgb): number =>
		{
			const linear = (_v: number): number =>
			{
				const s = _v / 255;
				return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
			};
			return 0.2126 * linear(_c.R) + 0.7152 * linear(_c.G) + 0.0722 * linear(_c.B);
		};
		const l1 = lum(_fg);
		const l2 = lum(_bg);
		return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 밝기를 바꾼다. -1~1. ThemeCreate 파생용.
	// @param _hex: 원본
	// @param _amount: 양
	public static Shift(_hex: string, _amount: number): string
	{
		const rgb = Color.Parse(_hex);
		if (rgb === null)
			return _hex;
		const apply = (_v: number): number =>
		{
			const moved = _amount >= 0 ? _v + (255 - _v) * _amount : _v * (1 + _amount);
			return Math.max(0, Math.min(255, Math.round(moved)));
		};
		const toHex = (_v: number): string => apply(_v).toString(16).padStart(2, "0");
		return `#${toHex(rgb.R)}${toHex(rgb.G)}${toHex(rgb.B)}`;
	}
}
