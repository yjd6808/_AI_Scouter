/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ItemsControl. 항목↔컨테이너 생성·재사용.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { Control } from "../Control";
import { UIValues } from "../../Xml/UIValue";

export class ItemContainerGenerator
{
	// ==================== 멤버 ====================
	private readonly map_ = new Map<number, UIElement>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 인덱스 컨테이너를 구한다. 없으면 null.
	// @param _index: 인덱스
	public ContainerFromIndex(_index: number): UIElement | null
	{
		return this.map_.get(_index) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨테이너의 인덱스를 구한다. 없으면 -1.
	// @param _container: 컨테이너
	public IndexFromContainer(_container: UIElement): number
	{
		for (const [idx, el] of this.map_)
		{
			if (el === _container)
				return idx;
		}
		return -1;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨테이너를 기록한다.
	// @param _index: 인덱스
	// @param _container: 컨테이너
	public Realize(_index: number, _container: UIElement): void
	{
		this.map_.set(_index, _container);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기록을 지운다.
	// @param _index: 인덱스
	public Recycle(_index: number): void
	{
		this.map_.delete(_index);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 지운다.
	public Clear(): void
	{
		this.map_.clear();
	}
}

export class ItemsControl extends Control
{
	// ==================== 정적 ====================
	public static readonly DisplayMemberPathProperty = UIProperty.Register<string>("DisplayMemberPath", ItemsControl, { Default: "" });
	public static readonly IsVirtualizingProperty = UIProperty.Register<boolean>("IsVirtualizing", ItemsControl, { Default: false });

	// ==================== 멤버 ====================
	protected items_: unknown[] = [];
	protected readonly generator_ = new ItemContainerGenerator();
	private itemTemplate_: ((_item: unknown, _index: number) => UIElement) | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 컨트롤 뼈대를 만든다.
	protected constructor()
	{
		super();
	}

	// ==================== 속성 ====================
	public get Items(): ReadonlyArray<unknown> { return this.items_; }
	public get DisplayMemberPath(): string { return this.GetValue(ItemsControl.DisplayMemberPathProperty); }
	public set DisplayMemberPath(_v: string) { this.SetValue(ItemsControl.DisplayMemberPathProperty, _v); }
	public get ItemTemplate(): ((_item: unknown, _index: number) => UIElement) | null { return this.itemTemplate_; }
	public set ItemTemplate(_v: ((_item: unknown, _index: number) => UIElement) | null) { this.itemTemplate_ = _v; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 통째로 바꾼다. 컨테이너는 재사용.
	// @param _items: 항목 목록
	public SetItems(_items: ReadonlyArray<unknown>): void
	{
		this.items_ = [..._items];
		this.RebuildContainers();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인덱스 컨테이너를 구한다.
	// @param _index: 인덱스
	public ContainerFromIndex(_index: number): UIElement | null
	{
		return this.generator_.ContainerFromIndex(_index);
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 인덱스 컨테이너를 만든다. 기본은 ItemTemplate 또는 텍스트.
	// @param _index: 인덱스
	protected GetContainer(_index: number): UIElement
	{
		const item = this.items_[_index];
		if (this.itemTemplate_ !== null)
			return this.itemTemplate_(item, _index);
		return this.CreateDefaultContainer(item);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨테이너에 항목을 입힌다. DisplayMemberPath 적용.
	// @param _container: 컨테이너
	// @param _item: 항목
	protected PrepareContainer(_container: UIElement, _item: unknown): void
	{
		const path = this.DisplayMemberPath;
		if (path.length > 0 && typeof _item === "object" && _item !== null)
			_container.Element.textContent = UIValues.ToDisplay(UIValues.From((_item as Record<string, unknown>)[path]));
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 길이 차이만큼만 고치고 전부 재준비한다.
	private RebuildContainers(): void
	{
		while (this.Children.length > this.items_.length)
		{
			const last = this.Children[this.Children.length - 1] as UIElement;
			this.generator_.Recycle(this.Children.length - 1);
			this.RemoveChild(last, true);
		}
		for (let idx = 0; idx < this.items_.length; ++idx)
		{
			let container = this.generator_.ContainerFromIndex(idx);
			if (container === null)
			{
				container = this.GetContainer(idx);
				this.generator_.Realize(idx, container);
				this.AddChild(container);
			}
			this.PrepareContainer(container, this.items_[idx]);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기본 텍스트 컨테이너. ContentControl이 있으면 Content로.
	// @param _item: 항목
	private CreateDefaultContainer(_item: unknown): UIElement
	{
		const text = typeof _item === "string" ? _item : UIValues.ToText(_item);
		const box = new DefaultItemBox();
		box.SetText(text);
		return box;
	}
}

class DefaultItemBox extends UIElement
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 기본 항목 박스를 만든다.
	public constructor()
	{
		super();
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트를 쓴다.
	// @param _text: 텍스트
	public SetText(_text: string): void
	{
		this.Element.textContent = _text;
	}
}
