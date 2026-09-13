/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CheckBox. 커스텀 박스 토글.
*/

import { ToggleButton } from "./ToggleButton";
import { UIProperty } from "../Core/UIProperty";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("CheckBox")
export class CheckBox extends ToggleButton
{
	// ==================== 멤버 ====================
	private readonly box_: HTMLSpanElement;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 체크박스를 만든다. 박스+체크 아이콘을 앞에 둔다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-checkbox");
		this.Element.setAttribute("role", "checkbox");
		this.box_ = document.createElement("span");
		this.box_.classList.add("gui-checkbox__box");
		this.box_.setAttribute("aria-hidden", "true");
		this.box_.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M20 6 9 17l-5-5'/></svg>";
		this.Element.prepend(this.box_);
		this.ApplyAriaChecked(this.IsChecked);
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 체크 상태를 aria에 싣는다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === ToggleButton.IsCheckedProperty)
			this.ApplyAriaChecked(_value as boolean);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// aria-checked를 갱신한다.
	// @param _checked: 체크 여부
	private ApplyAriaChecked(_checked: boolean): void
	{
		this.Element.setAttribute("aria-checked", _checked ? "true" : "false");
	}
}
