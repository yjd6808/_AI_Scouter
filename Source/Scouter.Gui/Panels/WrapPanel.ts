/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: WrapPanel. flex-wrap 번역이다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Orientation } from "../Core/UITypes";
import { Panel } from "./Panel";

export class WrapPanel extends Panel
{
	// ==================== 정적 ====================
	public static readonly OrientationProperty = UIProperty.Register<Orientation>("Orientation", WrapPanel, { Default: Orientation.Horizontal });
	public static readonly ItemWidthProperty = UIProperty.Register<number>("ItemWidth", WrapPanel, { Default: NaN, Parse: (_text) => Number(_text) });
	public static readonly ItemHeightProperty = UIProperty.Register<number>("ItemHeight", WrapPanel, { Default: NaN, Parse: (_text) => Number(_text) });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// wrap div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-wrap");
	}

	// ==================== 속성 ====================
	public get Orientation(): Orientation { return this.GetValue(WrapPanel.OrientationProperty); }
	public set Orientation(_v: Orientation) { this.SetValue(WrapPanel.OrientationProperty, _v); }

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// ItemWidth가 있으면 자식 폭을 강제한다.
	// @param _child: 자식
	protected override ApplyChildLayout(_child: UIElement): void
	{
		const w = this.GetValue(WrapPanel.ItemWidthProperty);
		const h = this.GetValue(WrapPanel.ItemHeightProperty);
		if (!Number.isNaN(w))
			_child.Element.style.width = `${w}px`;
		if (!Number.isNaN(h))
			_child.Element.style.height = `${h}px`;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === WrapPanel.OrientationProperty)
			this.Element.classList.toggle("is-vertical", (_value as Orientation) === Orientation.Vertical);
	}
}
