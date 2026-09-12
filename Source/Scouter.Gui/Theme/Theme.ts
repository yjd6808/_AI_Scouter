/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 테마 타입. opencode 포맷 그대로. 코어 토큰은 컨트롤 실사용분.
*/

export type ThemeScheme = "Dark" | "Light";
export type ThemeMode = "Dark" | "Light" | "System";
export type ThemeSource = "BuiltIn" | "User" | "Plugin";

export interface IThemeJson
{
	name: string;
	defs: Record<string, string>;
	theme: Record<string, { dark?: string; light?: string }>;
}

export interface ITheme
{
	Id: string;
	Name: string;
	Source: ThemeSource;
	Defs: Record<string, string>;
	Tokens: Record<string, { dark?: string; light?: string }>;
	HasLight: boolean;
	HasDark: boolean;
}

export interface IResolvedTheme
{
	Id: string;
	Scheme: ThemeScheme;
	Tokens: Map<string, string>;
}

export interface ITypography
{
	FontSize: number;
	FontFamily: string;
	MonoFamily: string;
}

export type DensityKind = "Normal" | "Compact";

// P5 코어 토큰. 컨트롤 CSS 실사용 + 문서 표준명. 256 전체는 테마 확보 후.
export const kCoreTokens: string[] = [
	"background-base", "background-panel", "background-hover", "background-active", "background-inverted",
	"text-base", "text-weak", "text-strong",
	"border", "border-weak-base", "border-active",
	"primary", "primary-hover", "primary-active", "primary-foreground", "primary-muted",
	"button-background", "button-text", "button-hover-background", "button-active-background",
	"input-background", "error", "error-foreground", "warning", "success",
	"shadow", "shadow-md", "accent", "accent-foreground",
	"syntax-keyword", "syntax-string", "syntax-comment", "syntax-function", "syntax-number", "syntax-type",
	"icon-base", "icon-weak-base",
];
