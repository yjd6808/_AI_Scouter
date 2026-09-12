/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: StatusBar. DockPanel 기반 24px 상태줄.
*/

import { UIElement } from "../../Core/UIElement";
import { RegisterElement } from "../RegisterElement";
import { DockPanel } from "../../Panels/DockPanel";

@RegisterElement("StatusBar")
export class StatusBar extends DockPanel
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태줄을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-statusbar");
	}
}

@RegisterElement("StatusBarItem")
export class StatusBarItem extends UIElement
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 자리를 만든다.
	public constructor()
	{
		super("span");
		this.Element.classList.add("gui-statusbar__item");
	}
}
