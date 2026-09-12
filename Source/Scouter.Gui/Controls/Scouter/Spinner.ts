/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Spinner. CSS 회전 표시.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { RegisterElement } from "../RegisterElement";

@RegisterElement("Spinner")
export class Spinner extends UIElement
{
	// ==================== 정적 ====================
	public static readonly SizeProperty = UIProperty.Register<number>("Size", Spinner, { Default: 16, Parse: (_text) => Number(_text) });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 스피너를 만든다.
	public constructor()
	{
		super("span");
		this.Element.classList.add("gui-spinner");
		this.ApplySize(this.Size);
	}

	// ==================== 속성 ====================
	public get Size(): number { return this.GetValue(Spinner.SizeProperty); }
	public set Size(_v: number) { this.SetValue(Spinner.SizeProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 크기를 쓴다.
	// @param _px: 픽셀
	private ApplySize(_px: number): void
	{
		this.Element.style.width = `${_px}px`;
		this.Element.style.height = `${_px}px`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Spinner.SizeProperty)
			this.ApplySize(_value as number);
	}
}
