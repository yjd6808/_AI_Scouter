/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Viewbox. 자식을 스케일로 맞춘다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Decorator } from "./Decorator";

export enum Stretch
{
	Uniform = "Uniform",
	Fill = "Fill",
	UniformToFill = "UniformToFill",
	None = "None",
}

export class Viewbox extends Decorator
{
	// ==================== 정적 ====================
	public static readonly StretchProperty = UIProperty.Register<Stretch>("Stretch", Viewbox, { Default: Stretch.Uniform });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// viewbox div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-viewbox");
	}

	// ==================== 속성 ====================
	public get Stretch(): Stretch { return this.GetValue(Viewbox.StretchProperty); }
	public set Stretch(_v: Stretch) { this.SetValue(Viewbox.StretchProperty, _v); }

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식이 붙으면 스케일을 다시 잰다.
	// @param _child: 자식
	protected override OnChildAdded(_child: UIElement): void
	{
		this.Rescale();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 크기가 바뀌면 스케일을 다시 잰다.
	// @param _w: 너비
	// @param _h: 높이
	protected override OnSizeChanged(_w: number, _h: number): void
	{
		this.Rescale();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자기 크기와 자식 크기로 scale을 건다.
	private Rescale(): void
	{
		const child = this.Child;
		if (child === null || this.Stretch === Stretch.None)
		{
			if (child !== null)
				child.Element.style.transform = "";
			return;
		}
		const hostW = this.Element.clientWidth;
		const hostH = this.Element.clientHeight;
		const childW = child.Element.scrollWidth;
		const childH = child.Element.scrollHeight;
		if (hostW === 0 || hostH === 0 || childW === 0 || childH === 0)
			return;
		let scale: number;
		if (this.Stretch === Stretch.Fill)
			scale = Math.max(hostW / childW, hostH / childH);
		else if (this.Stretch === Stretch.UniformToFill)
			scale = Math.max(hostW / childW, hostH / childH);
		else
			scale = Math.min(hostW / childW, hostH / childH);
		child.Element.style.transformOrigin = "0 0";
		child.Element.style.transform = `scale(${scale})`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Viewbox.StretchProperty)
			this.Rescale();
	}
}
