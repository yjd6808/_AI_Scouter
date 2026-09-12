/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CheckBox. 커스텀 박스 토글.
*/

import { ToggleButton } from "./ToggleButton";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("CheckBox")
export class CheckBox extends ToggleButton
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 체크박스를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-checkbox");
		this.Element.setAttribute("role", "checkbox");
	}
}
