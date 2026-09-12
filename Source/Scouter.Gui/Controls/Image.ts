/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Image. 파일·리소스 그림.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("Image")
export class Image extends UIElement
{
	// ==================== 정적 ====================
	public static readonly SourceProperty = UIProperty.Register<string>("Source", Image, { Default: "" });
	public static readonly StretchProperty = UIProperty.Register<string>("Stretch", Image, { Default: "Uniform" });

	// ==================== 멤버 ====================
	private readonly img_: HTMLImageElement;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// img를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-image");
		this.img_ = document.createElement("img");
		this.img_.setAttribute("draggable", "false");
		this.Element.append(this.img_);
	}

	// ==================== 속성 ====================
	public get Source(): string { return this.GetValue(Image.SourceProperty); }
	public set Source(_v: string) { this.SetValue(Image.SourceProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Image.SourceProperty)
		{
			if ((_value as string).length > 0)
				this.img_.setAttribute("src", _value as string);
			else
				this.img_.removeAttribute("src");
		}
		else if (_prop === Image.StretchProperty)
		{
			this.img_.style.objectFit = (_value as string).toLowerCase();
		}
	}
}
