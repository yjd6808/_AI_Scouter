/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Badge. 작은 수·상태 알약.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { RegisterElement } from "../RegisterElement";

@RegisterElement("Badge")
export class Badge extends UIElement
{
	// ==================== 정적 ====================
	public static readonly TextProperty = UIProperty.Register<string>("Text", Badge, { Default: "" });
	public static readonly VariantProperty = UIProperty.Register<string>("Variant", Badge, { Default: "Info" });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 알약을 만든다.
	public constructor()
	{
		super("span");
		this.Element.classList.add("gui-badge", "variant-info");
	}

	// ==================== 속성 ====================
	public get Text(): string { return this.GetValue(Badge.TextProperty); }
	public set Text(_v: string) { this.SetValue(Badge.TextProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Badge.TextProperty)
		{
			this.Element.textContent = _value as string;
		}
		else if (_prop === Badge.VariantProperty)
		{
			this.Element.classList.remove("variant-info", "variant-success", "variant-warn", "variant-error");
			this.Element.classList.add(`variant-${(_value as string).toLowerCase()}`);
		}
	}
}
