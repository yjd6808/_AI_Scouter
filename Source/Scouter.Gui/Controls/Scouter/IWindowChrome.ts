/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: IWindowChrome. Gui는 Electron을 모르므로 App이 구현을 꽂는다.
*/

import { SimpleEvent } from "../../Core/SimpleEvent";

export interface IWindowChrome
{
	Minimize(): void;
	ToggleMaximize(): void;
	Close(): void;
	IsMaximized(): Promise<boolean>;
	MaximizedChanged: SimpleEvent<boolean>;
	ToggleTopmost?(): Promise<boolean>;
	IsTopmost?(): Promise<boolean>;
	TopmostChanged?: SimpleEvent<boolean>;
}
