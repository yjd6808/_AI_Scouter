/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Expander·GroupBox. 접이·테두리 묶음.
*/

import { UIProperty } from "../../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { ContentControl } from "../ContentControl";
import { RegisterElement } from "../RegisterElement";
import { ToggleButton } from "../ToggleButton";

@RegisterElement("Expander")
export class Expander extends ContentControl
{
	// ==================== 정적 ====================
	public static readonly HeaderProperty = UIProperty.Register<string>("Header", Expander, { Default: "" });
	public static readonly IsExpandedProperty = UIProperty.Register<boolean>("IsExpanded", Expander, { Default: true });

	// ==================== 멤버 ====================
	private readonly header_: ToggleButton;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더 버튼+본문을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-expander");
		this.header_ = new ToggleButton();
		this.header_.Element.classList.add("gui-expander__header");
		this.Element.prepend(this.header_.Element);
		this.header_.Click.Add(() =>
		{
			this.IsExpanded = !this.IsExpanded;
		});
		this.Refresh();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더 버튼을 정리한다. 논리 자식이 아니라 직접 폐기.
	protected override OnDispose(): void
	{
		this.header_.Dispose();
	}

	// ==================== 속성 ====================
	public get Header(): string { return this.GetValue(Expander.HeaderProperty); }
	public set Header(_v: string) { this.SetValue(Expander.HeaderProperty, _v); }
	public get IsExpanded(): boolean { return this.GetValue(Expander.IsExpandedProperty); }
	public set IsExpanded(_v: boolean) { this.SetValue(Expander.IsExpandedProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly Expanded = new RoutedEvent<RoutedEventArgs>("Expanded", RoutingStrategy.Bubble);
	public readonly Collapsed = new RoutedEvent<RoutedEventArgs>("Collapsed", RoutingStrategy.Bubble);

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 펼침 상태를 갱신한다. 헤더는 항상 남기고 본문만 감춘다.
	// Visibility.Collapsed 전용인 is-collapsed와 이름이 겹치지 않도록 전용 클래스를 쓴다.
	private Refresh(): void
	{
		const open = this.IsExpanded;
		this.header_.IsChecked = open;
		this.header_.Content = `${open ? "▾" : "▸"} ${this.Header}`;
		this.header_.Element.setAttribute("aria-expanded", open ? "true" : "false");
		this.Element.classList.toggle("is-expander-collapsed", !open);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Expander.HeaderProperty || _prop === Expander.IsExpandedProperty)
		{
			this.Refresh();
			if (_prop === Expander.IsExpandedProperty)
				this.RaiseEvent((_value as boolean) ? this.Expanded : this.Collapsed, new RoutedEventArgs(this));
		}
	}
}

@RegisterElement("GroupBox")
export class GroupBox extends ContentControl
{
	// ==================== 정적 ====================
	public static readonly HeaderProperty = UIProperty.Register<string>("Header", GroupBox, { Default: "" });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// fieldset을 만든다.
	public constructor()
	{
		super("fieldset");
		this.Element.classList.add("gui-groupbox");
		this.Refresh();
	}

	// ==================== 속성 ====================
	public get Header(): string { return this.GetValue(GroupBox.HeaderProperty); }
	public set Header(_v: string) { this.SetValue(GroupBox.HeaderProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// legend를 갱신한다.
	private Refresh(): void
	{
		let legend = this.Element.querySelector("legend");
		if (legend === null)
		{
			legend = document.createElement("legend");
			this.Element.prepend(legend);
		}
		legend.textContent = this.Header;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === GroupBox.HeaderProperty)
			this.Refresh();
	}
}
