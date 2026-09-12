/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Control 추상 베이스. 폰트·색·패딩 스타일 속성을 둔다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Thickness } from "../Core/Thickness";

export class Control extends UIElement
{
	// ==================== 정적 ====================
	public static readonly PaddingProperty = UIProperty.Register<Thickness>("Padding", Control, { Default: () => new Thickness(0, 0, 0, 0), Parse: (_text) => Thickness.Parse(_text) });
	public static readonly BackgroundProperty = UIProperty.Register<string>("Background", Control, { Default: "" });
	public static readonly ForegroundProperty = UIProperty.Register<string>("Foreground", Control, { Default: "" });
	public static readonly BorderBrushProperty = UIProperty.Register<string>("BorderBrush", Control, { Default: "" });
	public static readonly FontSizeProperty = UIProperty.Register<number>("FontSize", Control, { Default: 13, Parse: (_text) => Number(_text) });
	public static readonly FontFamilyProperty = UIProperty.Register<string>("FontFamily", Control, { Default: "" });
	public static readonly FontWeightProperty = UIProperty.Register<string>("FontWeight", Control, { Default: "" });
	public static readonly IsTabStopProperty = UIProperty.Register<boolean>("IsTabStop", Control, { Default: true });
	public static readonly TabIndexProperty = UIProperty.Register<number>("TabIndex", Control, { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly VariantProperty = UIProperty.Register<string>("Variant", Control, { Default: "" });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨트롤 div를 만든다.
	// @param _tag: DOM 태그
	protected constructor(_tag = "div")
	{
		super(_tag);
	}

	// ==================== 속성 ====================
	public get Padding(): Thickness { return this.GetValue(Control.PaddingProperty); }
	public set Padding(_v: Thickness) { this.SetValue(Control.PaddingProperty, _v); }
	public get Background(): string { return this.GetValue(Control.BackgroundProperty); }
	public set Background(_v: string) { this.SetValue(Control.BackgroundProperty, _v); }
	public get Foreground(): string { return this.GetValue(Control.ForegroundProperty); }
	public set Foreground(_v: string) { this.SetValue(Control.ForegroundProperty, _v); }
	public get Variant(): string { return this.GetValue(Control.VariantProperty); }
	public set Variant(_v: string) { this.SetValue(Control.VariantProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Control.PaddingProperty)
			this.Element.style.padding = (_value as Thickness).ToCss();
		else if (_prop === Control.BackgroundProperty)
			this.Element.style.background = _value as string;
		else if (_prop === Control.ForegroundProperty)
			this.Element.style.color = _value as string;
		else if (_prop === Control.BorderBrushProperty)
			this.Element.style.borderColor = _value as string;
		else if (_prop === Control.FontSizeProperty)
			this.Element.style.fontSize = `${_value as number}px`;
		else if (_prop === Control.FontFamilyProperty)
			this.Element.style.fontFamily = _value as string;
		else if (_prop === Control.FontWeightProperty)
			this.Element.style.fontWeight = _value as string;
		else if (_prop === Control.VariantProperty)
			this.Element.dataset["variant"] = _value as string;
	}
}
