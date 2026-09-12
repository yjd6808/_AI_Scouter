/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RadioButton. 켜기만 되는 토글.
*/

import { UIProperty } from "../Core/UIProperty";
import { ToggleButton } from "./ToggleButton";
import { RadioGroupScope } from "./RadioGroupScope";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("RadioButton")
export class RadioButton extends ToggleButton
{
	// ==================== 정적 ====================
	public static readonly GroupNameProperty = UIProperty.Register<string>("GroupName", RadioButton, { Default: "" });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 라디오를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-radio");
		this.Element.setAttribute("role", "radio");
	}

	// ==================== 속성 ====================
	public get GroupName(): string { return this.GetValue(RadioButton.GroupNameProperty); }
	public set GroupName(_v: string) { this.SetValue(RadioButton.GroupNameProperty, _v); }

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 붙으면 그룹에 등록한다.
	protected override OnLoaded(): void
	{
		RadioGroupScope.Register(this);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 켜기만 한다. 끌 수는 없다.
	protected override ToggleCore(): void
	{
		if (!this.IsChecked)
		{
			this.IsChecked = true;
			RadioGroupScope.Select(this);
		}
	}
}
