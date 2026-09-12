/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ToggleButton. 2상태 토글. CheckBox는 P4.
*/

import { UIProperty } from "../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../Core/RoutedEvent";
import { ButtonBase } from "./ButtonBase";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("ToggleButton")
export class ToggleButton extends ButtonBase
{
	// ==================== 정적 ====================
	public static readonly IsCheckedProperty = UIProperty.Register<boolean>("IsChecked", ToggleButton, { Default: false });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 토글 버튼을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-toggle");
		this.Element.setAttribute("role", "button");
		this.ApplyChecked(this.IsChecked);
	}

	// ==================== 속성 ====================
	public get IsChecked(): boolean { return this.GetValue(ToggleButton.IsCheckedProperty); }
	public set IsChecked(_v: boolean) { this.SetValue(ToggleButton.IsCheckedProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly Checked = new RoutedEvent<RoutedEventArgs>("Checked", RoutingStrategy.Bubble);
	public readonly Unchecked = new RoutedEvent<RoutedEventArgs>("Unchecked", RoutingStrategy.Bubble);

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 클릭이면 먼저 토글하고 기본 처리.
	protected override OnClick(): void
	{
		if (!this.IsEnabled)
			return;
		this.ToggleCore();
		super.OnClick();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 토글 본체. 라디오가 재정의한다.
	protected ToggleCore(): void
	{
		this.IsChecked = !this.IsChecked;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 체크 표시를 갱신한다.
	// @param _checked: 체크 여부
	private ApplyChecked(_checked: boolean): void
	{
		this.Element.classList.toggle("is-checked", _checked);
		this.Element.setAttribute("aria-pressed", _checked ? "true" : "false");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === ToggleButton.IsCheckedProperty)
		{
			const checked = _value as boolean;
			this.ApplyChecked(checked);
			this.RaiseEvent(checked ? this.Checked : this.Unchecked, new RoutedEventArgs(this));
		}
	}
}
