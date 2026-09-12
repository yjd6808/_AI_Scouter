/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PasswordBox. 마스킹 입력.
*/

import { UIProperty } from "../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../Core/RoutedEvent";
import { Control } from "./Control";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("PasswordBox")
export class PasswordBox extends Control
{
	// ==================== 정적 ====================
	public static readonly PasswordProperty = UIProperty.Register<string>("Password", PasswordBox, { Default: "" });
	public static readonly PlaceholderProperty = UIProperty.Register<string>("Placeholder", PasswordBox, { Default: "" });

	// ==================== 멤버 ====================
	private readonly input_: HTMLInputElement;
	private syncing_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// password input을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-textbox", "is-password");
		this.input_ = document.createElement("input");
		this.input_.setAttribute("type", "password");
		this.Element.append(this.input_);
		this.input_.addEventListener("input", () =>
		{
			this.syncing_ = true;
			this.Password = this.input_.value;
			this.syncing_ = false;
			this.RaiseEvent(this.PasswordChanged, new RoutedEventArgs(this));
		});
	}

	// ==================== 속성 ====================
	public get Password(): string { return this.GetValue(PasswordBox.PasswordProperty); }
	public set Password(_v: string) { this.SetValue(PasswordBox.PasswordProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly PasswordChanged = new RoutedEvent<RoutedEventArgs>("PasswordChanged", RoutingStrategy.Bubble);

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === PasswordBox.PasswordProperty)
		{
			if (!this.syncing_)
				this.input_.value = _value as string;
		}
		else if (_prop === PasswordBox.PlaceholderProperty)
		{
			this.input_.placeholder = _value as string;
		}
	}
}
