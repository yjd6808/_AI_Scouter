/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Host·Controls 등록. P1은 등록할 태그가 없어 갈고리만 둔다.
*/

import { Gui } from "../Core/Gui";

Gui.OnRegister(() =>
{
	// P1: Window/UserControl은 코드로만 생성. XML 태그 등록은 07 로더와 함께.
});

export { Control } from "../Controls/Control";
export { ContentControl } from "../Controls/ContentControl";
export { ContentPresenter } from "../Controls/ContentPresenter";
export { Window, ClosingEventArgs } from "./Window";
export { UserControl } from "./UserControl";
export { UIManager, ToastKind } from "./UIManager";
export type { IToastOptions } from "./UIManager";
export { UILayer, UILayerKind } from "./UILayer";
export { WindowRegistry } from "./WindowRegistry";
export type { WindowCtor } from "./WindowRegistry";
export { RegisterWindow } from "./RegisterWindow";
export { MapLayoutProvider } from "./MapLayoutProvider";
export type { ILayoutProvider } from "./ILayoutProvider";
export type { INavigationService } from "./INavigationService";
