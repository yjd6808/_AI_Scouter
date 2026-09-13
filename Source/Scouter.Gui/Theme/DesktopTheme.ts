/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: 데스크톱 테마 타입. 시드·팔레트 변형 2종(light/dark).
*/

export interface IThemeSeedColors
{
	Neutral: string;
	Primary: string;
	Success: string;
	Warning: string;
	Error: string;
	Info: string;
	Interactive: string;
	DiffAdd?: string;
	DiffDelete?: string;
}

export interface IThemePaletteColors
{
	Neutral: string;
	Ink: string;
	Primary: string;
	Success: string;
	Warning: string;
	Error: string;
	Info: string;
	Accent?: string;
	Interactive?: string;
	DiffAdd?: string;
	DiffDelete?: string;
}

export interface IDesktopVariant
{
	Seeds?: IThemeSeedColors;
	Palette?: IThemePaletteColors;
	Overrides?: Record<string, string>;
}

export interface IDesktopThemeJson
{
	name: string;
	id: string;
	light: IDesktopVariant;
	dark: IDesktopVariant;
}

// 디스크 JSON 원문. 소문자 키(seeds·palette·overrides) + 느슨한 값.
export interface IRawDesktopVariant
{
	seeds?: Record<string, string>;
	palette?: Record<string, string>;
	overrides?: Record<string, string>;
}

// 디스크 JSON 원문. id 없음이면 파일명으로 대신한다.
export interface IRawDesktopThemeJson
{
	name: string;
	id?: string;
	light: IRawDesktopVariant;
	dark: IRawDesktopVariant;
}

export type DesktopScheme = "light" | "dark";
