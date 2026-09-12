/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Avatar. 이니셜·이미지 원형 뱃지.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { RegisterElement } from "../RegisterElement";

@RegisterElement("Avatar")
export class Avatar extends UIElement
{
	// ==================== 정적 ====================
	public static readonly TextProperty = UIProperty.Register<string>("Text", Avatar, { Default: "" });
	public static readonly SourceProperty = UIProperty.Register<string>("Source", Avatar, { Default: "" });
	public static readonly SizeProperty = UIProperty.Register<number>("Size", Avatar, { Default: 28, Parse: (_text) => Number(_text) });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 아바타를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-avatar");
	}

	// ==================== 속성 ====================
	public get Text(): string { return this.GetValue(Avatar.TextProperty); }
	public set Text(_v: string) { this.SetValue(Avatar.TextProperty, _v); }
	public get Source(): string { return this.GetValue(Avatar.SourceProperty); }
	public set Source(_v: string) { this.SetValue(Avatar.SourceProperty, _v); }
	public get Size(): number { return this.GetValue(Avatar.SizeProperty); }
	public set Size(_v: number) { this.SetValue(Avatar.SizeProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Avatar.TextProperty || _prop === Avatar.SourceProperty || _prop === Avatar.SizeProperty)
			this.Render();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이미지·이니셜을 그린다.
	private Render(): void
	{
		const size = this.Size;
		this.Element.style.width = `${size}px`;
		this.Element.style.height = `${size}px`;
		this.Element.textContent = "";
		if (this.Source.length > 0)
		{
			const img = document.createElement("img");
			img.src = this.Source;
			img.alt = this.Text;
			this.Element.append(img);
			return;
		}
		const initials = this.Text.trim().split(/\s+/).map((_w) => _w[0] ?? "").join("").slice(0, 2).toUpperCase();
		this.Element.textContent = initials;
	}
}
