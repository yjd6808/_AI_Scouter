/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Separator. 구분선.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Orientation } from "../Core/UITypes";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("Separator")
export class Separator extends UIElement
{
	// ==================== 정적 ====================
	public static readonly OrientationProperty = UIProperty.Register<Orientation>("Orientation", Separator, { Default: Orientation.Horizontal });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 구분선을 만든다.
	public constructor()
	{
		super("hr");
		this.Element.classList.add("gui-separator");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Separator.OrientationProperty)
			this.Element.classList.toggle("is-vertical", (_value as Orientation) === Orientation.Vertical);
	}
}
