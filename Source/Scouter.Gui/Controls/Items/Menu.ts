/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MenuBase·Menu·MenuItem. 막대·서브메뉴 메뉴.
*/

import { UIProperty } from "../../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { Control } from "../Control";
import { ButtonBase } from "../ButtonBase";
import { RegisterElement } from "../RegisterElement";
import { Popup } from "./Popup";

@RegisterElement("MenuItem")
export class MenuItem extends Control
{
	// ==================== 정적 ====================
	public static readonly HeaderProperty = UIProperty.Register<string>("Header", MenuItem, { Default: "" });
	public static readonly IconProperty = UIProperty.Register<string>("Icon", MenuItem, { Default: "" });
	public static readonly InputGestureTextProperty = UIProperty.Register<string>("InputGestureText", MenuItem, { Default: "" });
	public static readonly IsCheckableProperty = UIProperty.Register<boolean>("IsCheckable", MenuItem, { Default: false });
	public static readonly IsCheckedProperty = UIProperty.Register<boolean>("IsChecked", MenuItem, { Default: false });
	public static readonly CommandProperty = UIProperty.Register<string>("Command", MenuItem, { Default: "" });
	public static readonly CommandParameterProperty = UIProperty.Register<string>("CommandParameter", MenuItem, { Default: "" });

	// ==================== 멤버 ====================
	private readonly subItems_: MenuItem[] = [];

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 메뉴 항목을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-menuitem");
		this.Element.setAttribute("role", "menuitem");
		this.PointerDown.Add((_s, _a) =>
		{
			_a.Handled = true;
			this.Activate();
		});
	}

	// ==================== 속성 ====================
	public get Header(): string { return this.GetValue(MenuItem.HeaderProperty); }
	public set Header(_v: string) { this.SetValue(MenuItem.HeaderProperty, _v); }
	public get Icon(): string { return this.GetValue(MenuItem.IconProperty); }
	public set Icon(_v: string) { this.SetValue(MenuItem.IconProperty, _v); }
	public get InputGestureText(): string { return this.GetValue(MenuItem.InputGestureTextProperty); }
	public set InputGestureText(_v: string) { this.SetValue(MenuItem.InputGestureTextProperty, _v); }
	public get IsCheckable(): boolean { return this.GetValue(MenuItem.IsCheckableProperty); }
	public set IsCheckable(_v: boolean) { this.SetValue(MenuItem.IsCheckableProperty, _v); }
	public get IsChecked(): boolean { return this.GetValue(MenuItem.IsCheckedProperty); }
	public set IsChecked(_v: boolean) { this.SetValue(MenuItem.IsCheckedProperty, _v); }
	public get Command(): string { return this.GetValue(MenuItem.CommandProperty); }
	public set Command(_v: string) { this.SetValue(MenuItem.CommandProperty, _v); }
	public get CommandParameter(): string { return this.GetValue(MenuItem.CommandParameterProperty); }
	public set CommandParameter(_v: string) { this.SetValue(MenuItem.CommandParameterProperty, _v); }
	public get Items(): MenuItem[] { return this.subItems_; }

	// ==================== 이벤트 ====================
	public readonly Click = new RoutedEvent<RoutedEventArgs>("Click", RoutingStrategy.Bubble);

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식 항목을 단다. 서브메뉴용.
	// @param _item: 자식 항목
	public AddItem(_item: MenuItem): void
	{
		this.subItems_.push(_item);
		this.Render();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행한다. 체커블이면 토글 후 Click·Command 순.
	public Activate(): void
	{
		if (this.IsCheckable)
			this.IsChecked = !this.IsChecked;
		this.RaiseEvent(this.Click, new RoutedEventArgs(this));
		if (this.Command.length > 0 && ButtonBase.DefaultCommands !== null && ButtonBase.DefaultCommands.Has(this.Command))
			ButtonBase.DefaultCommands.Execute(this.Command, this.CommandParameter);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더·아이콘·단축키·서브 표시를 그린다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === MenuItem.HeaderProperty || _prop === MenuItem.IconProperty || _prop === MenuItem.InputGestureTextProperty || _prop === MenuItem.IsCheckedProperty || _prop === MenuItem.IsCheckableProperty)
			this.Render();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 DOM을 다시 만든다.
	private Render(): void
	{
		this.Element.textContent = "";
		if (this.IsCheckable)
		{
			const check = document.createElement("span");
			check.className = "gui-menuitem__check";
			check.textContent = this.IsChecked ? "✓" : "";
			this.Element.append(check);
		}
		else if (this.Icon.length > 0)
		{
			const icon = document.createElement("span");
			icon.className = "gui-menuitem__icon";
			icon.textContent = this.Icon;
			this.Element.append(icon);
		}
		const header = document.createElement("span");
		header.className = "gui-menuitem__header";
		header.textContent = this.Header;
		this.Element.append(header);
		if (this.InputGestureText.length > 0)
		{
			const gesture = document.createElement("span");
			gesture.className = "gui-menuitem__gesture";
			gesture.textContent = this.InputGestureText;
			this.Element.append(gesture);
		}
		if (this.subItems_.length > 0)
		{
			const arrow = document.createElement("span");
			arrow.className = "gui-menuitem__arrow";
			arrow.textContent = "▸";
			this.Element.append(arrow);
		}
	}
}

export class MenuBase extends Control
{
	// ==================== 정적 ====================
	protected static s_open_: MenuBase | null = null;

	// ==================== 멤버 ====================
	protected readonly popup_ = new Popup();
	protected readonly items_: MenuItem[] = [];

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 메뉴 뼈대를 만든다. StaysOpen=false로 바깥 닫기.
	protected constructor()
	{
		super();
		this.popup_.StaysOpen = false;
	}

	// ==================== 속성 ====================
	public get IsOpen(): boolean { return this.popup_.IsOpen; }

	// ==================== 이벤트 ====================
	public readonly Opened = new RoutedEvent<RoutedEventArgs>("Opened", RoutingStrategy.Bubble);
	public readonly Closed = new RoutedEvent<RoutedEventArgs>("Closed", RoutingStrategy.Bubble);

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 단다.
	// @param _item: 항목
	public AddItem(_item: MenuItem): void
	{
		this.items_.push(_item);
		this.popup_.AddChild(_item);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 연다. 이미 열린 메뉴는 닫는다(단일 오픈).
	public Open(): void
	{
		if (MenuBase.s_open_ !== null && MenuBase.s_open_ !== this)
			MenuBase.s_open_.Close();
		MenuBase.s_open_ = this;
		this.popup_.IsOpen = true;
		this.RaiseEvent(this.Opened, new RoutedEventArgs(this));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫는다.
	public Close(): void
	{
		if (MenuBase.s_open_ === this)
			MenuBase.s_open_ = null;
		if (this.popup_.IsOpen)
		{
			this.popup_.IsOpen = false;
			this.RaiseEvent(this.Closed, new RoutedEventArgs(this));
		}
	}
}

@RegisterElement("Menu")
export class Menu extends MenuBase
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 가로 막대를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-menu");
		this.Element.setAttribute("role", "menubar");
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 최상위 헤더를 막대에 깐다. 자식이 있으면 서브 팝업, 없으면 즉시 실행.
	// @param _item: 항목
	public override AddItem(_item: MenuItem): void
	{
		this.items_.push(_item);
		const head = document.createElement("div");
		head.className = "gui-menu__head";
		head.textContent = _item.Header;
		head.setAttribute("role", "menuitem");
		this.Element.append(head);
		head.addEventListener("pointerdown", (_e) =>
		{
			_e.stopPropagation();
			if (_item.Items.length > 0)
				this.OpenSub(_item, head);
			else
				_item.Activate();
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 서브 항목 팝업을 연다.
	// @param _item: 부모 항목
	// @param _anchor: 앵커 DOM
	private OpenSub(_item: MenuItem, _anchor: HTMLElement): void
	{
		for (const child of [...this.popup_.Children])
			this.popup_.RemoveChild(child, false);
		for (const child of _item.Items)
			this.popup_.AddChild(child);
		const rect = _anchor.getBoundingClientRect();
		this.popup_.Element.style.minWidth = `${Math.max(160, rect.width)}px`;
		this.popup_.Element.style.left = `${rect.left}px`;
		this.popup_.Element.style.top = `${rect.bottom}px`;
		this.Open();
	}
}
