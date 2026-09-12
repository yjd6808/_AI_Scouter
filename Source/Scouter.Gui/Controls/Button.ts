/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Button. Variant·Icon·IsDefault.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { ButtonBase } from "./ButtonBase";
import { ContentControl } from "./ContentControl";
import { RegisterElement } from "./RegisterElement";
import { Visibility } from "../Core/UITypes";

@RegisterElement("Button")
export class Button extends ButtonBase
{
	// ==================== 정적 ====================
	public static override readonly VariantProperty = UIProperty.Register<string>("Variant", Button, { Default: "Default" });
	public static readonly IsDefaultProperty = UIProperty.Register<boolean>("IsDefault", Button, { Default: false });
	public static readonly IsCancelProperty = UIProperty.Register<boolean>("IsCancel", Button, { Default: false });

	// ==================== 멤버 ====================
	private readonly presenter_: HTMLSpanElement;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 아이콘+텍스트 구조를 만든다. 아이콘은 베이스가 소유.
	public constructor()
	{
		super();
		this.presenter_ = document.createElement("span");
		this.presenter_.className = "gui-button__content";
		this.Element.append(this.presenter_);
	}

	// ==================== 속성 ====================
	public override get Variant(): string { return this.GetValue(Button.VariantProperty); }
	public override set Variant(_v: string) { this.SetValue(Button.VariantProperty, _v); }

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Content 교체 후 텍스트를 present한다. 베이스 span 대신 전용 presenter 사용.
	// @param _old: 이전
	// @param _next: 새 값
	protected override OnContentChanged(_old: UIElement | string | null, _next: UIElement | string | null): void
	{
		if (typeof _next === "string")
			this.presenter_.textContent = _next;
		else
			this.presenter_.textContent = "";
		this.Element.classList.toggle("is-icon-only", _next === null && this.icon_.Visibility === Visibility.Visible);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다. Content는 베이스 처리를 건너뛰고 직접 한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		if (_prop === ContentControl.ContentProperty)
		{
			for (const child of [...this.Children])
			{
				if (child !== this.icon_)
					this.RemoveChild(child, false);
			}
			if (_value instanceof UIElement)
				this.AddChild(_value);
			this.OnContentChanged(null, _value as UIElement | string | null);
			return;
		}
		super.ApplyProperty(_prop, _value);
		if (_prop === Button.VariantProperty)
		{
			this.Element.classList.remove("variant-default", "variant-primary", "variant-danger", "variant-ghost");
			this.Element.classList.add(`variant-${(_value as string).toLowerCase()}`);
		}
	}
}
