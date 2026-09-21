/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 테마 타입. opencode 포맷 그대로. 코어 토큰은 컨트롤 실사용분.
*/

export type ThemeScheme = "Dark" | "Light";
export type ThemeMode = "Dark" | "Light";
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
	Desktop?: IDesktopTokens;
}

export interface IDesktopTokens
{
	Dark: Record<string, string>;
	Light: Record<string, string>;
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
	// 오버레이 딤. 모달·팝오버가 아래 화면을 가릴 때 쓰는 반투명 스크림이다.
	// 코어로 올려 데스크톱이 아닌 구포맷 테마도 폴백 값을 받게 한다. 없으면 {$theme.overlay-scrim}이 조용히 투명이 된다.
	"overlay-scrim", "overlay-scrim-weak",
];

// 데스크톱(seeds·palette) 토큰명을 코어 토큰명으로 잇는다.
export const kDesktopCoreAliases: ReadonlyMap<string, string> = new Map<string, string>([
	["background-panel", "surface-float-base"],
	["background-hover", "surface-base-hover"],
	["background-active", "surface-base-active"],
	["background-inverted", "surface-raised-strong"],
	["border", "border-base"],
	["border-active", "border-active"],
	["primary", "surface-brand-base"],
	["primary-hover", "surface-brand-hover"],
	["primary-active", "surface-interactive-base"],
	["primary-foreground", "text-on-brand-base"],
	["primary-muted", "surface-interactive-weak"],
	["button-background", "surface-raised-strong"],
	["button-text", "text-base"],
	["button-hover-background", "surface-raised-strong-hover"],
	["button-active-background", "surface-base-active"],
	["input-background", "input-base"],
	["error", "syntax-critical"],
	["error-foreground", "text-on-critical-base"],
	["warning", "syntax-warning"],
	["success", "syntax-success"],
	["accent", "text-interactive-base"],
	["accent-foreground", "text-on-interactive-base"],
]);
