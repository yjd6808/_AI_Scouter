/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Label. 대상 지정 캡션.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { ContentControl } from "./ContentControl";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("Label")
export class Label extends ContentControl
{
	// ==================== 정적 ====================
	public static readonly TargetProperty = UIProperty.Register<string>("Target", Label, { Default: "" });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// label을 만든다.
	public constructor()
	{
		super("label");
		this.Element.classList.add("gui-label");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Label.TargetProperty)
		{
			const name = _value as string;
			if (name.startsWith("#"))
			{
				const scope = this.Parent ?? this;
				const target = scope.FindName(UIElement, name.slice(1));
				if (target !== null)
					this.Element.setAttribute("for", target.Element.dataset["testid"] ?? "");
			}
		}
	}
}
