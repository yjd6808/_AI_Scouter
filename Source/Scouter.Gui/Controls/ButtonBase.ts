/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ButtonBase. 포인터·키·커맨드 실행 뼈대.
*/

import { UIProperty } from "../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy, PointerEventArgs } from "../Core/RoutedEvent";
import { InputDispatcher } from "../Core/InputDispatcher";
import { ContentControl } from "./ContentControl";
import { Control } from "./Control";
import { Icon } from "./Icon";
import { Visibility } from "../Core/UITypes";
import type { ICommandSource } from "../Xml/LoadContext";

export enum ClickMode
{
	Release = "Release",
	Press = "Press",
}

export class ButtonBase extends ContentControl
{
	// ==================== 정적 ====================
	public static readonly CommandProperty = UIProperty.Register<string>("Command", ButtonBase, { Default: "" });
	public static readonly CommandParameterProperty = UIProperty.Register<string>("CommandParameter", ButtonBase, { Default: "" });
	public static readonly ClickModeProperty = UIProperty.Register<ClickMode>("ClickMode", ButtonBase, { Default: ClickMode.Release });
	public static readonly IconProperty = UIProperty.Register<string>("Icon", ButtonBase, { Default: "" });
	public static DefaultCommands: ICommandSource | null = null;

	// ==================== 멤버 ====================
	protected readonly icon_: Icon;
	private isPressed_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 버튼 뼈대를 만든다. 네이티브 button 사용.
	protected constructor()
	{
		super("button");
		this.Element.classList.add("gui-button");
		this.Element.setAttribute("type", "button");
		this.Focusable = true;
		this.icon_ = new Icon();
		this.icon_.Visibility = Visibility.Collapsed;
		this.Element.append(this.icon_.Element);
		this.PointerDown.Add((_s, _a) => { this.HandleDown(_a); });
		this.PointerUp.Add((_s, _a) => { this.HandleUp(_a); });
		this.KeyDown.Add((_s, _a) =>
		{
			if (_a.Key === "Enter" || _a.Key === " ")
				this.OnClick();
		});
	}

	// ==================== 속성 ====================
	public get Command(): string { return this.GetValue(ButtonBase.CommandProperty); }
	public set Command(_v: string) { this.SetValue(ButtonBase.CommandProperty, _v); }
	public get CommandParameter(): string { return this.GetValue(ButtonBase.CommandParameterProperty); }
	public set CommandParameter(_v: string) { this.SetValue(ButtonBase.CommandParameterProperty, _v); }
	public get Icon(): string { return this.GetValue(ButtonBase.IconProperty); }
	public set Icon(_v: string) { this.SetValue(ButtonBase.IconProperty, _v); }
	public get IsPressed(): boolean { return this.isPressed_; }

	// ==================== 이벤트 ====================
	public readonly Click = new RoutedEvent<RoutedEventArgs>("Click", RoutingStrategy.Bubble);

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 클릭 확정. Click 발화 후 Command 실행.
	protected OnClick(): void
	{
		if (!this.IsEnabled)
			return;
		this.RaiseEvent(this.Click, new RoutedEventArgs(this));
		if (this.Command.length > 0 && ButtonBase.DefaultCommands !== null && ButtonBase.DefaultCommands.Has(this.Command))
			ButtonBase.DefaultCommands.Execute(this.Command, this.CommandParameter);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 누름 시작. 캡처 + pressed 표시. Press 모드면 즉시 발화.
	// @param _a: 인자
	protected HandleDown(_a: PointerEventArgs): void
	{
		if (!this.IsEnabled)
			return;
		this.isPressed_ = true;
		this.Element.classList.add("is-pressed");
		InputDispatcher.Capture(this, _a.PointerId);
		if (this.GetValue(ButtonBase.ClickModeProperty) === ClickMode.Press)
			this.OnClick();
		_a.Handled = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 뗌. 히트면 발화.
	// @param _a: 인자
	protected HandleUp(_a: PointerEventArgs): void
	{
		if (!this.isPressed_)
			return;
		this.isPressed_ = false;
		this.Element.classList.remove("is-pressed");
		InputDispatcher.Release(_a.PointerId);
		if (!this.IsEnabled)
			return;
		const pos = _a.GetPosition(this);
		const rect = this.Element.getBoundingClientRect();
		if (pos.X >= 0 && pos.Y >= 0 && pos.X <= rect.width && pos.Y <= rect.height)
			this.OnClick();
		_a.Handled = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다. ToggleButton 계열 Variant도 variant-* 클래스로 둔다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === ButtonBase.IconProperty)
		{
			this.icon_.Name = _value as string;
			this.icon_.Visibility = (_value as string).length > 0 ? Visibility.Visible : Visibility.Collapsed;
		}
		else if (_prop === Control.VariantProperty)
		{
			this.Element.classList.remove("variant-default", "variant-primary", "variant-danger", "variant-ghost");
			const variant = (_value as string).toLowerCase();
			if (variant.length > 0)
				this.Element.classList.add(`variant-${variant}`);
		}
	}
}
