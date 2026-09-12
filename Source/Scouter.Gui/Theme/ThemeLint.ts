/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeLint. hex 형식 + 대비 검사.
*/

import { Color } from "./Color";
import type { ITheme } from "./Theme";

export interface IThemeLintMessage
{
	Token: string;
	Text: string;
}

export interface IThemeLintResult
{
	Errors: IThemeLintMessage[];
	Warnings: IThemeLintMessage[];
}

const kContrastPairs: Array<[string, string]> = [["text-base", "background-base"], ["text-weak", "background-base"], ["button-text", "button-background"]];

export class ThemeLint
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마를 검사한다. 에러는 형식, 경고는 대비.
	// @param _theme: 테마
	public static Run(_theme: ITheme): IThemeLintResult
	{
		const errors: IThemeLintMessage[] = [];
		const warnings: IThemeLintMessage[] = [];
		for (const [token, pair] of Object.entries(_theme.Tokens))
		{
			for (const scheme of ["dark", "light"] as const)
			{
				const value = pair[scheme];
				if (value === undefined)
					continue;
				if (value.startsWith("$"))
					continue;
				if (!Color.IsHex(value))
					errors.push({ Token: token, Text: `${scheme} hex 아님: ${value}` });
			}
		}
		for (const [fg, bg] of kContrastPairs)
		{
			for (const scheme of ["dark", "light"] as const)
			{
				const fgRaw = _theme.Tokens[fg]?.[scheme];
				const bgRaw = _theme.Tokens[bg]?.[scheme];
				if (fgRaw === undefined || bgRaw === undefined || fgRaw.startsWith("$") || bgRaw.startsWith("$"))
					continue;
				const fgRgb = Color.Parse(fgRaw);
				const bgRgb = Color.Parse(bgRaw);
				if (fgRgb === null || bgRgb === null)
					continue;
				if (Color.Contrast(fgRgb, bgRgb) < 4.5)
					warnings.push({ Token: fg, Text: `${scheme} 대비 4.5 미만 (${bg} 위)` });
			}
		}
		return { Errors: errors, Warnings: warnings };
	}
}
