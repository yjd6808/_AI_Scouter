/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Selector. SelectionModel 위의 단일·다중·확장 선택.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { ItemsControl } from "./ItemsControl";
import { SelectionModel } from "./SelectionModel";

export enum SelectionMode
{
	Single = "Single",
	Multiple = "Multiple",
	Extended = "Extended",
}

export enum SelectionSource
{
	Pointer = "Pointer",
	Keyboard = "Keyboard",
	Code = "Code",
}

export class SelectionChangedEventArgs extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly AddedItems: unknown[];
	public readonly RemovedItems: unknown[];
	public readonly Cause: SelectionSource;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 증분을 담는다.
	// @param _source: 발신 요소
	// @param _added: 추가 항목
	// @param _removed: 제거 항목
	// @param _from: 원인
	public constructor(_source: UIElement, _added: unknown[], _removed: unknown[], _from: SelectionSource)
	{
		super(_source);
		this.AddedItems = _added;
		this.RemovedItems = _removed;
		this.Cause = _from;
	}
}

export abstract class Selector extends ItemsControl
{
	// ==================== 정적 ====================
	public static readonly SelectionModeProperty = UIProperty.Register<SelectionMode>("SelectionMode", Selector, { Default: SelectionMode.Single });

	// ==================== 멤버 ====================
	protected readonly selection_ = new SelectionModel();

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 셀렉터 뼈대를 만든다.
	protected constructor()
	{
		super();
	}

	// ==================== 속성 ====================
	public get SelectionMode(): SelectionMode { return this.GetValue(Selector.SelectionModeProperty); }
	public set SelectionMode(_v: SelectionMode) { this.SetValue(Selector.SelectionModeProperty, _v); }

	//////////////////////////////////////////////////////////////////////////////////////
	// 주 선택 인덱스를 읽는다. 없으면 -1.
	public get SelectedIndex(): number { return this.selection_.Primary; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 주 선택 인덱스를 쓴다. 음수면 해제.
	public set SelectedIndex(_v: number)
	{
		this.SelectIndices(_v < 0 ? [] : [_v], SelectionSource.Code);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 주 선택 항목을 읽는다. 없으면 null.
	public get SelectedItem(): unknown
	{
		const idx = this.selection_.Primary;
		return idx < 0 ? null : this.items_[idx] ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 주 선택 항목을 쓴다. 없으면 해제.
	public set SelectedItem(_v: unknown)
	{
		const idx = this.items_.indexOf(_v);
		this.SelectIndices(idx < 0 ? [] : [idx], SelectionSource.Code);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 항목 전부를 읽는다.
	public get SelectedItems(): unknown[]
	{
		return this.selection_.Indices.map((_i) => this.items_[_i]).filter((_item) => _item !== undefined);
	}

	// ==================== 이벤트 ====================
	public readonly SelectionChanged = new RoutedEvent<SelectionChangedEventArgs>("SelectionChanged", RoutingStrategy.Bubble);

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 전부 바꾸고 선택을 유지한다(객체 동등성).
	// @param _items: 항목 목록
	public override SetItems(_items: ReadonlyArray<unknown>): void
	{
		const selected = new Set(this.SelectedItems);
		super.SetItems(_items);
		const remapped: number[] = [];
		for (let idx = 0; idx < this.items_.length; ++idx)
		{
			if (selected.has(this.items_[idx]))
				remapped.push(idx);
		}
		this.SelectIndices(remapped, SelectionSource.Code);
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 인덱스 선택을 적용한다. 바뀐 컨테이너만 갱신.
	// @param _indices: 인덱스 목록
	// @param _source: 원인
	protected SelectIndices(_indices: number[], _source: SelectionSource): void
	{
		const diff = this.selection_.Replace(_indices);
		if (diff.IsEmpty)
			return;
		for (const idx of diff.Removed)
			this.SetContainerSelected(idx, false);
		for (const idx of diff.Added)
			this.SetContainerSelected(idx, true);
		const added = diff.Added.map((_i) => this.items_[_i]).filter((_item) => _item !== undefined);
		const removed = diff.Removed.map((_i) => this.items_[_i]).filter((_item) => _item !== undefined);
		this.RaiseEvent(this.SelectionChanged, new SelectionChangedEventArgs(this, added, removed, _source));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨테이너 선택 표시. 하위 클래스 구현.
	// @param _index: 인덱스
	// @param _selected: 선택 여부
	protected SetContainerSelected(_index: number, _selected: boolean): void
	{
		const container = this.ContainerFromIndex(_index);
		if (container !== null)
			container.Element.setAttribute("aria-selected", _selected ? "true" : "false");
	}
}
