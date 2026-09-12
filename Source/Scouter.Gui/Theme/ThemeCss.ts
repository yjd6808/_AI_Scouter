/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeCss. 해석 테마 → :root 변수 문자열.
*/

import type { IResolvedTheme, ITypography, DensityKind } from "./Theme";

export class ThemeCss
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// CSS를 만든다. 결정적 출력(스냅샷 가능).
	// @param _resolved: 해석 테마
	// @param _typo: 타이포
	// @param _density: 밀도
	public static Build(_resolved: IResolvedTheme, _typo: ITypography, _density: DensityKind): string
	{
		const keys = [..._resolved.Tokens.keys()].sort();
		const parts: string[] = [];
		for (const key of keys)
			parts.push(`--${key}:${_resolved.Tokens.get(key) as string};`);
		parts.push(`--gui-font-size:${_typo.FontSize}px;`);
		parts.push(`--gui-font-family:${_typo.FontFamily};`);
		parts.push(`--gui-font-mono:${_typo.MonoFamily};`);
		if (_density === "Compact")
		{
			parts.push("--gui-control-height:24px;--gui-radius:4px;--gui-gap:6px;");
		}
		else
		{
			parts.push("--gui-control-height:28px;--gui-radius:6px;--gui-gap:8px;");
		}
		return `:root{${parts.join("")}}`;
	}
}
