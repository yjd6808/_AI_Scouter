/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: TextBox. 네이티브 input/textarea 래퍼. 바인딩은 단방향.
*/

import { UIProperty } from "../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../Core/RoutedEvent";
import { Control } from "./Control";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("TextBox")
export class TextBox extends Control
{
	// ==================== 정적 ====================
	public static readonly TextProperty = UIProperty.Register<string>("Text", TextBox, { Default: "" });
	public static readonly PlaceholderProperty = UIProperty.Register<string>("Placeholder", TextBox, { Default: "" });
	public static readonly IsReadOnlyProperty = UIProperty.Register<boolean>("IsReadOnly", TextBox, { Default: false });
	public static readonly AcceptsReturnProperty = UIProperty.Register<boolean>("AcceptsReturn", TextBox, { Default: false });
	public static readonly MaxLengthProperty = UIProperty.Register<number>("MaxLength", TextBox, { Default: 0, Parse: (_text) => Number(_text) });

	// ==================== 멤버 ====================
	protected input_: HTMLInputElement | HTMLTextAreaElement;
	private syncing_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// input을 만든다. AcceptsReturn이면 textarea로 교체(P4 전체, P3는 input).
	public constructor()
	{
		super();
		this.Element.classList.add("gui-textbox");
		this.input_ = document.createElement("input");
		this.input_.setAttribute("type", "text");
		this.Element.append(this.input_);
		this.input_.addEventListener("input", () =>
		{
			this.OnNativeInput();
		});
		this.input_.addEventListener("keydown", (_e) =>
		{
			if (_e.key === "Enter" && !this.AcceptsReturn)
				this.RaiseEvent(this.TextCommitted, new RoutedEventArgs(this));
		});
		this.input_.addEventListener("blur", () =>
		{
			this.RaiseEvent(this.TextCommitted, new RoutedEventArgs(this));
		});
		this.ApplyText(this.Text);
	}

	// ==================== 속성 ====================
	public get Text(): string { return this.GetValue(TextBox.TextProperty); }
	public set Text(_v: string) { this.SetValue(TextBox.TextProperty, _v); }
	public get Placeholder(): string { return this.GetValue(TextBox.PlaceholderProperty); }
	public set Placeholder(_v: string) { this.SetValue(TextBox.PlaceholderProperty, _v); }
	public get IsReadOnly(): boolean { return this.GetValue(TextBox.IsReadOnlyProperty); }
	public set IsReadOnly(_v: boolean) { this.SetValue(TextBox.IsReadOnlyProperty, _v); }
	public get AcceptsReturn(): boolean { return this.GetValue(TextBox.AcceptsReturnProperty); }
	public set AcceptsReturn(_v: boolean) { this.SetValue(TextBox.AcceptsReturnProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly TextChanged = new RoutedEvent<RoutedEventArgs>("TextChanged", RoutingStrategy.Bubble);
	public readonly TextCommitted = new RoutedEvent<RoutedEventArgs>("TextCommitted", RoutingStrategy.Bubble);

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 선택한다.
	public SelectAll(): void
	{
		this.input_.select();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 네이티브 입력 → Text 갱신 → TextChanged.
	private OnNativeInput(): void
	{
		this.syncing_ = true;
		this.Text = this.input_.value;
		this.syncing_ = false;
		this.RaiseEvent(this.TextChanged, new RoutedEventArgs(this));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Text를 네이티브에 쓴다. 입력 중이면 건너뛴다.
	// @param _text: 텍스트
	private ApplyText(_text: string): void
	{
		if (!this.syncing_)
			this.input_.value = _text;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === TextBox.TextProperty)
			this.ApplyText(_value as string);
		else if (_prop === TextBox.PlaceholderProperty)
			this.input_.placeholder = _value as string;
		else if (_prop === TextBox.IsReadOnlyProperty)
			this.input_.readOnly = _value as boolean;
		else if (_prop === TextBox.MaxLengthProperty)
			this.input_.maxLength = _value as number <= 0 ? -1 : _value as number;
	}
}
