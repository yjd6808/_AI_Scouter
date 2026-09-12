/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Theme 모듈 등록 갈고리. 태그 없음.
*/

import { Gui } from "../Core/Gui";

Gui.OnRegister(() =>
{
	// P5: 테마는 태그가 없다.
});

export { kCoreTokens } from "./Theme";
export type { ITheme, IResolvedTheme, IThemeJson, ITypography, ThemeScheme, ThemeMode, ThemeSource, DensityKind } from "./Theme";
export { ThemeResolver } from "./ThemeResolver";
export { ThemeCss } from "./ThemeCss";
export { ThemeLint } from "./ThemeLint";
export type { IThemeLintMessage, IThemeLintResult } from "./ThemeLint";
export { Color } from "./Color";
export type { IRgb } from "./Color";
