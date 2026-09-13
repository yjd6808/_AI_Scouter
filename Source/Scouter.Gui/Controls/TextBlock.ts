/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: TextBlock. 읽기 전용 텍스트.
*/

import { UIProperty } from "../Core/UIProperty";
import { Control } from "./Control";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("TextBlock")
export class TextBlock extends Control
{
	// ==================== 정적 ====================
	public static readonly TextProperty = UIProperty.Register<string>("Text", TextBlock, { Default: "" });
	public static readonly TextWrappingProperty = UIProperty.Register<string>("TextWrapping", TextBlock, { Default: "NoWrap" });
	public static readonly TextTrimmingProperty = UIProperty.Register<string>("TextTrimming", TextBlock, { Default: "None" });
	public static readonly TextAlignmentProperty = UIProperty.Register<string>("TextAlignment", TextBlock, { Default: "Left" });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// span을 만든다.
	public constructor()
	{
		super("span");
		this.Element.classList.add("gui-text");
	}

	// ==================== 속성 ====================
	public get Text(): string { return this.GetValue(TextBlock.TextProperty); }
	public set Text(_v: string) { this.SetValue(TextBlock.TextProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === TextBlock.TextProperty)
			this.Element.textContent = _value as string;
		else if (_prop === TextBlock.TextWrappingProperty)
			this.Element.style.whiteSpace = (_value as string) === "Wrap" ? "normal" : "nowrap";
		else if (_prop === TextBlock.TextTrimmingProperty)
		{
			this.Element.style.overflow = (_value as string) === "None" ? "" : "hidden";
			this.Element.style.textOverflow = (_value as string) === "CharacterEllipsis" ? "ellipsis" : "clip";
		}
		else if (_prop === TextBlock.TextAlignmentProperty)
			this.Element.style.textAlign = (_value as string).toLowerCase();
	}
}
