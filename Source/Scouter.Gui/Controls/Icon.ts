/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Icon. SVG 스프라이트 use 참조.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("Icon")
export class Icon extends UIElement
{
	// ==================== 정적 ====================
	public static override readonly NameProperty = UIProperty.Register<string>("Name", Icon, { Default: "" });
	public static readonly SizeProperty = UIProperty.Register<number>("Size", Icon, { Default: 16, Parse: (_text) => Number(_text) });

	// ==================== 멤버 ====================
	private readonly use_: SVGUseElement;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// svg > use 구조를 만든다. 기본 크기는 CSS 변수(--gui-icon-size)를 따른다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-icon");
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.use_ = document.createElementNS("http://www.w3.org/2000/svg", "use");
		svg.append(this.use_);
		this.Element.append(svg);
		this.Element.style.width = "var(--gui-icon-size, 16px)";
		this.Element.style.height = "var(--gui-icon-size, 16px)";
	}

	// ==================== 속성 ====================
	public override get Name(): string { return this.GetValue(Icon.NameProperty); }
	public override set Name(_v: string) { this.SetValue(Icon.NameProperty, _v); }
	public get Size(): number { return this.GetValue(Icon.SizeProperty); }
	public set Size(_v: number) { this.SetValue(Icon.SizeProperty, _v); }

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
		if (_prop === Icon.NameProperty)
			this.use_.setAttribute("href", `#lucide-${_value as string}`);
		else if (_prop === Icon.SizeProperty)
			this.ApplySize(_value as number);
	}
}
