/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ListBox·ListBoxItem. 키보드·다중 선택 리스트.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { ContentControl } from "../ContentControl";
import { RegisterElement } from "../RegisterElement";
import { Selector, SelectionMode, SelectionSource } from "./Selector";
import { UIValues } from "../../Xml/UIValue";

@RegisterElement("ListBoxItem")
export class ListBoxItem extends ContentControl
{
	// ==================== 정적 ====================
	public static readonly IsSelectedProperty = UIProperty.Register<boolean>("IsSelected", ListBoxItem, { Default: false });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-listbox__item");
		this.Element.setAttribute("role", "option");
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 표시를 바꾼다.
	// @param _selected: 선택 여부
	public SetSelected(_selected: boolean): void
	{
		this.SetValue(ListBoxItem.IsSelectedProperty, _selected);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === ListBoxItem.IsSelectedProperty)
		{
			this.Element.classList.toggle("is-selected", _value as boolean);
			this.Element.setAttribute("aria-selected", (_value as boolean) ? "true" : "false");
		}
	}
}

@RegisterElement("ListBox")
export class ListBox extends Selector
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 리스트를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-listbox");
		this.Element.setAttribute("role", "listbox");
		this.Element.tabIndex = 0;
		this.Focusable = true;
		this.KeyDown.Add((_s, _a) =>
		{
			this.HandleKey(_a.Key, _a.Shift, _a.Ctrl);
		});
		this.PointerDown.Add((_s, _a) =>
		{
			// GridView 헤더 클릭은 선택으로 번지지 않게. P4 한정 결합.
			const native = _a.Native.target as Element | null;
			if (native !== null && typeof native.closest === "function" && native.closest(".gui-gridview__header") !== null)
				return;
			const idx = this.IndexFromEvent(_a.GetPosition(this));
			if (idx >= 0)
				this.ClickIndex(idx, _a.Shift, _a.Ctrl);
		});
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 클릭 선택. Shift 범위, Ctrl 토글.
	// @param _index: 인덱스
	// @param _shift: Shift
	// @param _ctrl: Ctrl
	public ClickIndex(_index: number, _shift: boolean, _ctrl: boolean): void
	{
		if (this.SelectionMode === SelectionMode.Extended && _shift)
		{
			const anchor = this.selection_.Anchor < 0 ? _index : this.selection_.Anchor;
			const lo = Math.min(anchor, _index);
			const hi = Math.max(anchor, _index);
			const range: number[] = [];
			for (let idx = lo; idx <= hi; ++idx)
				range.push(idx);
			this.SelectIndices(range, SelectionSource.Pointer);
		}
		else if ((this.SelectionMode === SelectionMode.Extended || this.SelectionMode === SelectionMode.Multiple) && _ctrl)
		{
			this.ToggleIndex(_index);
		}
		else
		{
			this.SelectIndices([_index], SelectionSource.Pointer);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인덱스로 스크롤한다.
	// @param _index: 인덱스
	public ScrollIntoView(_index: number): void
	{
		this.ContainerFromIndex(_index)?.Element.scrollIntoView({ block: "nearest" });
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 인덱스 컨테이너는 ListBoxItem으로 감싼다.
	// @param _index: 인덱스
	protected override GetContainer(_index: number): UIElement
	{
		const item = new ListBoxItem();
		item.Content = super.GetContainer(_index);
		return item;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// DisplayMemberPath는 안쪽 내용에만 쓴다. 래퍼 텍스트를 지우지 않게.
	// @param _container: 컨테이너
	// @param _item: 항목
	protected override PrepareContainer(_container: UIElement, _item: unknown): void
	{
		if (_container instanceof ListBoxItem && this.DisplayMemberPath.length > 0 && typeof _item === "object" && _item !== null)
		{
			const inner = _container.Content;
			if (inner instanceof UIElement)
				inner.Element.textContent = UIValues.ToDisplay(UIValues.From((_item as Record<string, unknown>)[this.DisplayMemberPath]));
			return;
		}
		super.PrepareContainer(_container, _item);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨테이너 선택 표시.
	// @param _index: 인덱스
	// @param _selected: 선택 여부
	protected override SetContainerSelected(_index: number, _selected: boolean): void
	{
		super.SetContainerSelected(_index, _selected);
		const container = this.ContainerFromIndex(_index);
		if (container instanceof ListBoxItem)
			container.SetSelected(_selected);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 단일 토글.
	// @param _index: 인덱스
	private ToggleIndex(_index: number): void
	{
		const diff = this.selection_.Toggle(_index);
		if (diff.IsEmpty)
			return;
		for (const idx of diff.Removed)
			this.SetContainerSelected(idx, false);
		for (const idx of diff.Added)
			this.SetContainerSelected(idx, true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키보드 이동. ↑↓ Home End.
	// @param _key: 키
	// @param _shift: Shift
	// @param _ctrl: Ctrl
	private HandleKey(_key: string, _shift: boolean, _ctrl: boolean): void
	{
		const current = this.SelectedIndex;
		if (_key === "ArrowDown" || _key === "ArrowUp")
		{
			const next = _key === "ArrowDown" ? current + 1 : current - 1;
			if (next >= 0 && next < this.Items.length)
				this.ClickIndex(next, _shift, _ctrl);
		}
		else if (_key === "Home" && this.Items.length > 0)
		{
			this.ClickIndex(0, _shift, _ctrl);
		}
		else if (_key === "End" && this.Items.length > 0)
		{
			this.ClickIndex(this.Items.length - 1, _shift, _ctrl);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 좌표에서 인덱스를 찾는다. 고정 28px 가정(P4).
	// @param _pos: 상대 좌표
	private IndexFromEvent(_pos: { X: number; Y: number }): number
	{
		const idx = Math.floor(_pos.Y / 28);
		return idx >= 0 && idx < this.Items.length ? idx : -1;
	}
}
