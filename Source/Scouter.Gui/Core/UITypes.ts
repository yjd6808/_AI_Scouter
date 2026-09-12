/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Gui 공용 열거·좌표. Thickness는 별도 파일이다.
*/

export enum Visibility
{
	Visible = "Visible",
	Hidden = "Hidden",
	Collapsed = "Collapsed",
}

export enum HAlign
{
	Left = "Left",
	Center = "Center",
	Right = "Right",
	Stretch = "Stretch",
}

export enum VAlign
{
	Top = "Top",
	Center = "Center",
	Bottom = "Bottom",
	Stretch = "Stretch",
}

export enum Orientation
{
	Horizontal = "Horizontal",
	Vertical = "Vertical",
}

export enum Dock
{
	Left = "Left",
	Top = "Top",
	Right = "Right",
	Bottom = "Bottom",
}

export interface IPoint
{
	X: number;
	Y: number;
}

export interface ISize
{
	Width: number;
	Height: number;
}
