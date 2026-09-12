/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 팔레트 항목·소스 계약. 명령·설정·테마·Plugin 공용.
*/

export type PaletteKind = "Command" | "Settings" | "Theme" | "Plugin";

export interface IPaletteItem
{
	Kind: PaletteKind;
	Title: string;
	Subtitle: string;
	Hotkey: string;
	Score: number;
	Run(): void | Promise<void>;
}

export interface ISettingsPaletteItem extends IPaletteItem
{
	Kind: "Settings";
	Key: string;
}

export interface IThemePaletteItem extends IPaletteItem
{
	Kind: "Theme";
	ThemeId: string;
}

export interface IItemSource
{
	readonly Prefix: string;
	Query(_text: string): IPaletteItem[];
}
