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
	// FontSize가 바뀌면 컨트롤 높이·아이콘·보조 폰트도 함께 스케일한다.
	// @param _resolved: 해석 테마
	// @param _typo: 타이포
	// @param _density: 밀도
	public static Build(_resolved: IResolvedTheme, _typo: ITypography, _density: DensityKind): string
	{
		const keys = [..._resolved.Tokens.keys()].sort();
		const parts: string[] = [];
		for (const key of keys)
			parts.push(`--${key}:${_resolved.Tokens.get(key) as string};`);
		const scale = _typo.FontSize / 13;
		const baseHeight = _density === "Compact" ? 24 : 28;
		const controlHeight = Math.max(16, Math.round(baseHeight * scale));
		const iconSize = _typo.FontSize + 3;
		const fontSm = Math.max(10, _typo.FontSize - 1);
		const tabHeight = controlHeight + 4;
		const statusHeight = Math.max(16, controlHeight - 4);
		const badgeHeight = fontSm + 8;
		parts.push(`--gui-font-size:${_typo.FontSize}px;`);
		parts.push(`--gui-font-sm:${fontSm}px;`);
		parts.push(`--gui-font-family:${_typo.FontFamily};`);
		parts.push(`--gui-font-mono:${_typo.MonoFamily};`);
		parts.push(`--gui-control-height:${controlHeight}px;`);
		parts.push(`--gui-icon-size:${iconSize}px;`);
		parts.push(`--gui-tab-height:${tabHeight}px;`);
		parts.push(`--gui-status-height:${statusHeight}px;`);
		parts.push(`--gui-badge-height:${badgeHeight}px;`);
		if (_density === "Compact")
		{
			parts.push("--gui-radius:4px;--gui-gap:6px;");
		}
		else
		{
			parts.push("--gui-radius:6px;--gui-gap:8px;");
		}
		return `:root{${parts.join("")}}`;
	}
}
