/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Border. 테두리·배경·패딩 래퍼다.
*/

import { UIProperty } from "../Core/UIProperty";
import { Thickness } from "../Core/Thickness";
import { Decorator } from "./Decorator";

export class Border extends Decorator
{
	// ==================== 정적 ====================
	public static readonly BorderThicknessProperty = UIProperty.Register<Thickness>("BorderThickness", Border, { Default: () => new Thickness(0, 0, 0, 0), Parse: (_text) => Thickness.Parse(_text) });
	public static readonly BorderBrushProperty = UIProperty.Register<string>("BorderBrush", Border, { Default: "" });
	public static readonly CornerRadiusProperty = UIProperty.Register<number>("CornerRadius", Border, { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly PaddingProperty = UIProperty.Register<Thickness>("Padding", Border, { Default: () => new Thickness(0, 0, 0, 0), Parse: (_text) => Thickness.Parse(_text) });
	public static readonly BackgroundProperty = UIProperty.Register<string>("Background", Border, { Default: "" });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// border div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-border");
	}

	// ==================== 속성 ====================
	public get Background(): string { return this.GetValue(Border.BackgroundProperty); }
	public set Background(_v: string) { this.SetValue(Border.BackgroundProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Border.BorderThicknessProperty)
			this.Element.style.borderWidth = (_value as Thickness).ToCss();
		else if (_prop === Border.BorderBrushProperty)
		{
			this.Element.style.borderStyle = (_value as string).length > 0 ? "solid" : "";
			this.Element.style.borderColor = _value as string;
		}
		else if (_prop === Border.CornerRadiusProperty)
			this.Element.style.borderRadius = `${_value as number}px`;
		else if (_prop === Border.PaddingProperty)
			this.Element.style.padding = (_value as Thickness).ToCss();
		else if (_prop === Border.BackgroundProperty)
			this.Element.style.background = _value as string;
	}
}
