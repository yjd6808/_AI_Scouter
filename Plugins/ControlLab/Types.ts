/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ControlLab 공용 타입. 이벤트 기록용.
*/

export type TControlEventKind = "info" | "success" | "warn" | "error";

export interface IControlEvent
{
	Kind: TControlEventKind;
	Name: string;
	Detail: string;
	At: number;
}
