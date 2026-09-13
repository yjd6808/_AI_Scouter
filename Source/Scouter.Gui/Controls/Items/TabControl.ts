/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: TabControl·TabItem. 미선택 탭은 hidden 유지.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { ContentControl } from "../ContentControl";
import { RegisterElement } from "../RegisterElement";
import { Selector, SelectionSource } from "./Selector";

@RegisterElement("TabItem")
export class TabItem extends ContentControl
{
	// ==================== 정적 ====================
	public static readonly HeaderProperty = UIProperty.Register<string>("Header", TabItem, { Default: "" });
	public static readonly IsClosableProperty = UIProperty.Register<boolean>("IsClosable", TabItem, { Default: false });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 탭 본문을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-tabpage");
		this.Element.setAttribute("role", "tabpanel");
	}

	// ==================== 속성 ====================
	public get Header(): string { return this.GetValue(TabItem.HeaderProperty); }
	public set Header(_v: string) { this.SetValue(TabItem.HeaderProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly CloseRequested = new RoutedEvent<RoutedEventArgs>("CloseRequested", RoutingStrategy.Bubble);
}

@RegisterElement("TabControl")
export class TabControl extends Selector
{
	// ==================== 멤버 ====================
	private readonly strip_: HTMLDivElement;
	private readonly body_: HTMLDivElement;
	private readonly tabs_ = new Map<number, HTMLButtonElement>();

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 스트립+본문을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-tabcontrol");
		this.strip_ = document.createElement("div");
		this.strip_.className = "gui-tabcontrol__strip";
		this.strip_.setAttribute("role", "tablist");
		this.body_ = document.createElement("div");
		this.body_.className = "gui-tabcontrol__content";
		this.Element.append(this.strip_, this.body_);
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식은 본문 div에 붙인다. 논리 트리는 그대로. TabItem은 항목으로도 받아들인다.
	// @param _child: 자식
	// @param _index: 위치
	public override AddChild(_child: UIElement, _index?: number): void
	{
		super.AddChild(_child, _index);
		this.body_.append(_child.Element);
		this.AdoptTab(_child);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 바꾸고 비었으면 첫 탭을 고른다.
	// @param _items: 항목 목록
	public override SetItems(_items: ReadonlyArray<unknown>): void
	{
		super.SetItems(_items);
		if (this.SelectedIndex < 0 && this.items_.length > 0)
			this.SelectIndices([0], SelectionSource.Code);
		else
			this.RefreshTabs();
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목은 TabItem이어야 한다. 스트립 버튼 + 본문 자식으로 배치.
	// @param _index: 인덱스
	protected override GetContainer(_index: number): UIElement
	{
		const item = this.items_[_index];
		if (item instanceof TabItem)
			return item;
		const wrap = new TabItem();
		wrap.Header = String(item);
		return wrap;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 탭만 보이고 스트립을 갱신한다.
	// @param _indices: 인덱스 목록
	// @param _source: 원인
	protected override SelectIndices(_indices: number[], _source: SelectionSource): void
	{
		super.SelectIndices(_indices, _source);
		this.RefreshTabs();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 직접 붙은 TabItem을 항목으로 받아들인다. XML 선언·코드 추가 공용.
	// SetItems가 만든 래퍼는 생성기가 이미 알므로 건너뛴다. 맨 끝에 둔다.
	// @param _child: 자식
	private AdoptTab(_child: UIElement): void
	{
		if (!(_child instanceof TabItem))
			return;
		if (this.generator_.IndexFromContainer(_child) >= 0)
			return;
		if (this.items_.includes(_child))
			return;
		this.items_.push(_child);
		this.generator_.Realize(this.items_.length - 1, _child);
		if (this.SelectedIndex < 0)
			this.SelectIndices([0], SelectionSource.Code);
		else
			this.RefreshTabs();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식 구성이 바뀌면 스트립을 다시 만든다.
	private RefreshTabs(): void
	{
		while (this.strip_.firstChild !== null)
			this.strip_.firstChild.remove();
		this.tabs_.clear();
		const selected = new Set(this.selection_.Indices);
		for (let idx = 0; idx < this.items_.length; ++idx)
		{
			const container = this.ContainerFromIndex(idx);
			const header = container instanceof TabItem ? container.Header : String(this.items_[idx]);
			const btn = document.createElement("button");
			btn.className = "gui-tab";
			btn.setAttribute("role", "tab");
			btn.textContent = header;
			btn.setAttribute("aria-selected", selected.has(idx) ? "true" : "false");
			if (selected.has(idx))
				btn.classList.add("is-selected");
			const at = idx;
			btn.addEventListener("click", () =>
			{
				this.SelectIndices([at], SelectionSource.Pointer);
			});
			this.strip_.append(btn);
			this.tabs_.set(idx, btn);
			if (container !== null)
			{
				if (selected.has(idx))
					container.Element.removeAttribute("hidden");
				else
					container.Element.setAttribute("hidden", "");
			}
		}
	}
}
