/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: StackPanel. flex + gap 번역이다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Orientation } from "../Core/UITypes";
import { Panel } from "./Panel";

export class StackPanel extends Panel
{
	// ==================== 정적 ====================
	public static readonly OrientationProperty = UIProperty.Register<Orientation>("Orientation", StackPanel, { Default: Orientation.Vertical });
	public static readonly SpacingProperty = UIProperty.Register<number>("Spacing", StackPanel, { Default: 0, Parse: (_text) => Number(_text) });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// flex div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-stack");
		this.ApplyOrientation(this.Orientation);
	}

	// ==================== 속성 ====================
	public get Orientation(): Orientation { return this.GetValue(StackPanel.OrientationProperty); }
	public set Orientation(_v: Orientation) { this.SetValue(StackPanel.OrientationProperty, _v); }
	public get Spacing(): number { return this.GetValue(StackPanel.SpacingProperty); }
	public set Spacing(_v: number) { this.SetValue(StackPanel.SpacingProperty, _v); }

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식은 flex 고정. Stretch면 교차축으로 늘린다.
	// @param _child: 자식
	protected override ApplyChildLayout(_child: UIElement): void
	{
		_child.Element.style.flex = "0 0 auto";
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 방향 클래스를 갱신한다.
	// @param _orientation: 방향
	private ApplyOrientation(_orientation: Orientation): void
	{
		this.Element.classList.toggle("is-horizontal", _orientation === Orientation.Horizontal);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === StackPanel.OrientationProperty)
			this.ApplyOrientation(_value as Orientation);
		else if (_prop === StackPanel.SpacingProperty)
			this.Element.style.gap = `${_value as number}px`;
	}
}
