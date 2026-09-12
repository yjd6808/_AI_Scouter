/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Panel 추상 베이스. 자식 추가/제거·붙임 속성 변경을 ApplyChildLayout으로 모은다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";

export abstract class Panel extends UIElement
{
	// ==================== 정적 ====================
	public static readonly BackgroundProperty = UIProperty.Register<string>("Background", Panel, { Default: "" });
	public static readonly ClipToBoundsProperty = UIProperty.Register<boolean>("ClipToBounds", Panel, { Default: false });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 패널 div를 만든다.
	// @param _tag: DOM 태그
	protected constructor(_tag = "div")
	{
		super(_tag);
	}

	// ==================== 속성 ====================
	public get Background(): string { return this.GetValue(Panel.BackgroundProperty); }
	public set Background(_v: string) { this.SetValue(Panel.BackgroundProperty, _v); }
	public get ClipToBounds(): boolean { return this.GetValue(Panel.ClipToBoundsProperty); }
	public set ClipToBounds(_v: boolean) { this.SetValue(Panel.ClipToBoundsProperty, _v); }

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식 1개의 레이아웃을 적용한다. 하위 클래스 구현.
	// @param _child: 자식
	protected abstract ApplyChildLayout(_child: UIElement): void;

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식이 붙으면 레이아웃을 건다.
	// @param _child: 자식
	protected override OnChildAdded(_child: UIElement): void
	{
		this.ApplyChildLayout(_child);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 붙임 속성이 바뀌면 해당 자식만 다시 건다.
	// @param _child: 자식
	// @param _prop: 붙임 속성 키
	protected override OnAttachedChanged(_child: UIElement, _prop: unknown): void
	{
		this.ApplyChildLayout(_child);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Panel.BackgroundProperty)
			this.Element.style.background = _value as string;
		else if (_prop === Panel.ClipToBoundsProperty)
			this.Element.style.overflow = (_value as boolean) ? "hidden" : "";
	}
}
