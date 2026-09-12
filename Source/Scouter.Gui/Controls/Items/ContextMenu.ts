/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ContextMenu. 우클릭 팝업 메뉴.
*/

import { RegisterElement } from "../RegisterElement";
import { MenuBase } from "./Menu";
import type { MenuItem } from "./Menu";

@RegisterElement("ContextMenu")
export class ContextMenu extends MenuBase
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 팝업 메뉴를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-contextmenu");
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 지정 좌표에 연다. 이미 열린 메뉴는 닫는다(단일 오픈).
	// @param _x: 화면 X
	// @param _y: 화면 Y
	public OpenAt(_x: number, _y: number): void
	{
		this.popup_.Element.style.left = `${_x}px`;
		this.popup_.Element.style.top = `${_y}px`;
		this.popup_.Element.style.minWidth = "160px";
		this.Open();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목들로 메뉴를 채워 한 번에 연다.
	// @param _items: 항목들
	// @param _x: 화면 X
	// @param _y: 화면 Y
	public OpenItems(_items: MenuItem[], _x: number, _y: number): void
	{
		for (const child of [...this.popup_.Children])
			this.popup_.RemoveChild(child, false);
		for (const item of _items)
			this.AddItem(item);
		this.OpenAt(_x, _y);
	}
}
