/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Decorator 추상 베이스. 자식 1개 래퍼다.
*/

import { UIElement } from "../Core/UIElement";

export abstract class Decorator extends UIElement
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 래퍼 div를 만든다.
	// @param _tag: DOM 태그
	protected constructor(_tag = "div")
	{
		super(_tag);
	}

	// ==================== 속성 ====================
	public get Child(): UIElement | null { return this.Children[0] ?? null; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식을 교체한다. 이전 자식은 폐기.
	public set Child(_v: UIElement | null)
	{
		this.ClearChildren();
		if (_v !== null)
			this.AddChild(_v);
	}
}
