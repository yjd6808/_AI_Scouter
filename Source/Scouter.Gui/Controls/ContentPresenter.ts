/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ContentPresenter. Shell이 Plugin 화면을 Dispose 없이 스와프하는 자리.
*/

import { UIElement } from "../Core/UIElement";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("ContentPresenter")
export class ContentPresenter extends UIElement
{
	// ==================== 멤버 ====================
	private content_: UIElement | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자리 div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-presenter");
	}

	// ==================== 속성 ====================
	public get Content(): UIElement | null { return this.content_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 내용을 교체한다. 이전 내용은 Dispose 없이 뗀다.
	public set Content(_v: UIElement | null)
	{
		this.Detach();
		this.content_ = _v;
		if (_v !== null)
			this.AddChild(_v);
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 내용을 DOM에서 떼고 반환한다. Dispose하지 않는다.
	public Detach(): UIElement | null
	{
		const prev = this.content_;
		if (prev !== null)
		{
			this.RemoveChild(prev, false);
			this.content_ = null;
		}
		return prev;
	}
}
