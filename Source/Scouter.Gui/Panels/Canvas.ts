/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Canvas. absolute 배치 번역이다.
*/

import { UIElement } from "../Core/UIElement";
import { Panel } from "./Panel";
import { AttachedProperty } from "./AttachedProperty";

export class Canvas extends Panel
{
	// ==================== 정적 ====================
	public static readonly LeftProperty = AttachedProperty.Register<number>("Canvas.Left", { Default: NaN, Parse: (_text) => Number(_text) });
	public static readonly TopProperty = AttachedProperty.Register<number>("Canvas.Top", { Default: NaN, Parse: (_text) => Number(_text) });
	public static readonly RightProperty = AttachedProperty.Register<number>("Canvas.Right", { Default: NaN, Parse: (_text) => Number(_text) });
	public static readonly BottomProperty = AttachedProperty.Register<number>("Canvas.Bottom", { Default: NaN, Parse: (_text) => Number(_text) });
	public static readonly ZIndexProperty = AttachedProperty.Register<number>("Canvas.ZIndex", { Default: 0, Parse: (_text) => Number(_text) });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// relative div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-canvas");
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식을 absolute로 놓고 붙임 좌표를 쓴다.
	// @param _child: 자식
	protected override ApplyChildLayout(_child: UIElement): void
	{
		const style = _child.Element.style;
		style.position = "absolute";
		const left = Canvas.LeftProperty.Get(_child);
		const top = Canvas.TopProperty.Get(_child);
		const right = Canvas.RightProperty.Get(_child);
		const bottom = Canvas.BottomProperty.Get(_child);
		style.left = Number.isNaN(left) ? "" : `${left}px`;
		style.top = Number.isNaN(top) ? "" : `${top}px`;
		style.right = Number.isNaN(right) ? "" : `${right}px`;
		style.bottom = Number.isNaN(bottom) ? "" : `${bottom}px`;
		style.zIndex = String(Canvas.ZIndexProperty.Get(_child));
	}
}
