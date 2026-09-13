/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ComboBox. 토글 + Popup 속 ListBox.
*/

import { UIProperty } from "../../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { ButtonBase } from "../ButtonBase";
import { RegisterElement } from "../RegisterElement";
import { Selector, SelectionSource } from "./Selector";
import { UIValues } from "../../Xml/UIValue";
import { ListBox } from "./ListBox";
import { Popup } from "./Popup";

@RegisterElement("ComboBox")
export class ComboBox extends Selector
{
	// ==================== 정적 ====================
	public static readonly IsDropDownOpenProperty = UIProperty.Register<boolean>("IsDropDownOpen", ComboBox, { Default: false });
	public static readonly IsEditableProperty = UIProperty.Register<boolean>("IsEditable", ComboBox, { Default: false });
	public static readonly MaxDropDownHeightProperty = UIProperty.Register<number>("MaxDropDownHeight", ComboBox, { Default: 300, Parse: (_text) => Number(_text) });

	// ==================== 멤버 ====================
	private readonly toggle_: ButtonBase;
	private readonly label_: HTMLSpanElement;
	private readonly popup_: Popup;
	private readonly list_: ListBox;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 토글+팝업을 만든다. 닫힘 상태 휠은 선택을 돌린다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-combobox");
		this.toggle_ = new ComboToggle();
		this.label_ = document.createElement("span");
		this.label_.className = "gui-combobox__value";
		this.toggle_.Element.append(this.label_);
		this.AddChild(this.toggle_);
		this.list_ = new ListBox();
		this.popup_ = new Popup();
		this.popup_.PlacementTarget = this;
		this.popup_.StaysOpen = false;
		this.popup_.AddChild(this.list_);
		this.toggle_.Click.Add(() =>
		{
			this.IsDropDownOpen = !this.IsDropDownOpen;
		});
		this.list_.SelectionChanged.Add((_s, _a) =>
		{
			this.SelectIndices(this.list_.SelectedIndex < 0 ? [] : [this.list_.SelectedIndex], SelectionSource.Pointer);
			if (this.IsDropDownOpen && _a.Cause !== SelectionSource.Code)
			{
				this.IsDropDownOpen = false;
				this.toggle_.Focus();
			}
		});
		this.Wheel.Add((_s, _a) =>
		{
			if (this.IsDropDownOpen)
			{
				_a.Handled = true;
				return;
			}
			if (this.OnWheelCycle(_a.DeltaY))
				_a.Handled = true;
		});
		this.RefreshLabel();
	}

	// ==================== 속성 ====================
	public get IsDropDownOpen(): boolean { return this.GetValue(ComboBox.IsDropDownOpenProperty); }
	public set IsDropDownOpen(_v: boolean) { this.SetValue(ComboBox.IsDropDownOpenProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly DropDownOpened = new RoutedEvent<RoutedEventArgs>("DropDownOpened", RoutingStrategy.Direct);
	public readonly DropDownClosed = new RoutedEvent<RoutedEventArgs>("DropDownClosed", RoutingStrategy.Direct);

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목이 바뀌면 드롭다운 목록도 바꾼다. 본문 컨테이너는 떼어낸다(팝업 ListBox가 대신 둔다).
	// @param _items: 항목 목록
	public override SetItems(_items: ReadonlyArray<unknown>): void
	{
		super.SetItems(_items);
		this.DetachOwnContainers();
		this.list_.DisplayMemberPath = this.DisplayMemberPath;
		this.list_.ItemTemplate = this.ItemTemplate;
		this.list_.SetItems(_items);
		this.RefreshLabel();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 열기·닫기를 팝업에 반영한다. 목록 높이는 상한을 둔다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === ComboBox.IsDropDownOpenProperty)
		{
			if (_value === true)
			{
				this.list_.SelectedIndex = this.SelectedIndex;
				const max = this.GetValue(ComboBox.MaxDropDownHeightProperty);
				this.list_.Element.style.maxHeight = Number.isFinite(max) && max > 0 ? `${max}px` : "";
				this.popup_.IsOpen = true;
				this.RaiseEvent(this.DropDownOpened, new RoutedEventArgs(this));
			}
			else
			{
				this.popup_.IsOpen = false;
				this.RaiseEvent(this.DropDownClosed, new RoutedEventArgs(this));
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫힘 상태 휠로 선택을 돌린다. 열린 목록은 네이티브 스크롤에 맡긴다. 움직이면 true.
	// @param _deltaY: 휠 양
	private OnWheelCycle(_deltaY: number): boolean
	{
		if (this.Items.length === 0)
			return false;
		const dir = _deltaY > 0 ? 1 : -1;
		const current = this.SelectedIndex < 0 ? (dir > 0 ? -1 : 0) : this.SelectedIndex;
		const next = Math.min(this.Items.length - 1, Math.max(0, current + dir));
		if (next === this.SelectedIndex)
			return false;
		this.SelectedIndex = next;
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 텍스트를 갱신한다.
	private RefreshLabel(): void
	{
		this.label_.textContent = UIValues.ToText(this.SelectedItem);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// super.SetItems가 본문에 붙인 항목 컨테이너를 떼어낸다. 토글은 둔다.
	private DetachOwnContainers(): void
	{
		for (const child of [...this.Children])
		{
			if (child !== this.toggle_)
				this.RemoveChild(child, false);
		}
		this.generator_.Clear();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택이 바뀌면 라벨도 바꾼다.
	// @param _indices: 인덱스 목록
	// @param _source: 원인
	protected override SelectIndices(_indices: number[], _source: SelectionSource): void
	{
		super.SelectIndices(_indices, _source);
		this.RefreshLabel();
	}
}

class ComboToggle extends ButtonBase
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 콤보 토글을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-combobox__toggle");
	}
}
