/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ContentControl. Content는 UIProperty라 XML 바인딩이 걸린다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Control } from "./Control";

export class ContentControl extends Control
{
	// ==================== 정적 ====================
	public static readonly ContentProperty = UIProperty.Register<unknown>("Content", ContentControl, { Default: null });

	// ==================== 멤버 ====================
	private textNode_: HTMLSpanElement | null = null;
	private contentElement_: UIElement | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 콘텐츠 div를 만든다.
	protected constructor(_tag = "div")
	{
		super(_tag);
	}

	// ==================== 속성 ====================
	public get Content(): UIElement | string | null { return this.GetValue(ContentControl.ContentProperty) as UIElement | string | null; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 콘텐츠를 교체한다. 문자열·요소·null 전부 받는다.
	public set Content(_v: UIElement | string | null)
	{
		this.SetValue(ContentControl.ContentProperty, _v);
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 콘텐츠 교체 후처리.
	// @param _old: 이전 콘텐츠
	// @param _next: 새 콘텐츠
	protected OnContentChanged(_old: UIElement | string | null, _next: UIElement | string | null): void
	{
		// 의도적 빈 구현. 하위 클래스 확장점.
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다. 문자열은 span, 요소는 자식으로.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop !== ContentControl.ContentProperty)
			return;
		const old = this.contentElement_;
		if (old instanceof UIElement)
			this.RemoveChild(old, false);
		if (this.textNode_ !== null)
		{
			this.textNode_.remove();
			this.textNode_ = null;
		}
		this.contentElement_ = null;
		if (_value instanceof UIElement)
		{
			this.contentElement_ = _value;
			this.AddChild(_value);
		}
		else if (typeof _value === "string")
		{
			this.textNode_ = document.createElement("span");
			this.textNode_.textContent = _value;
			this.Element.append(this.textNode_);
		}
		this.OnContentChanged(null, _value as UIElement | string | null);
	}
}
