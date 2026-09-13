/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: GridSplitter. 드래그로 행열 크기를 바꾼다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy, PointerEventArgs, ValueChangedEventArgs } from "../Core/RoutedEvent";
import { InputDispatcher } from "../Core/InputDispatcher";
import { Grid } from "./Grid";
import { GridLength, GridUnitType, RowDefinition, ColumnDefinition } from "./GridDefinitions";

export enum ResizeDirection
{
	Auto = "Auto",
	Rows = "Rows",
	Columns = "Columns",
}

export class GridSplitter extends UIElement
{
	// ==================== 정적 ====================
	public static readonly ResizeDirectionProperty = UIProperty.Register<ResizeDirection>("ResizeDirection", GridSplitter, { Default: ResizeDirection.Auto });

	// ==================== 멤버 ====================
	private grid_: Grid | null = null;
	private prevRow_: RowDefinition | null = null;
	private prevCol_: ColumnDefinition | null = null;
	private startPos_ = 0;
	private startPrev_ = 0;
	private onDown_: ((_s: UIElement, _a: PointerEventArgs) => void) | null = null;
	private onMove_: ((_s: UIElement, _a: PointerEventArgs) => void) | null = null;
	private onUp_: ((_s: UIElement, _a: PointerEventArgs) => void) | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// splitter div를 만들고 포인터 핸들러를 건다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-splitter");
		this.onDown_ = (_s, _a) => { this.HandleDown(_a); };
		this.onMove_ = (_s, _a) => { this.HandleMove(_a); };
		this.onUp_ = (_s, _a) => { this.HandleUp(_a); };
		this.PointerDown.Add(this.onDown_);
		this.PointerMove.Add(this.onMove_);
		this.PointerUp.Add(this.onUp_);
	}

	// ==================== 속성 ====================
	public get ResizeDirection(): ResizeDirection { return this.GetValue(GridSplitter.ResizeDirectionProperty); }
	public set ResizeDirection(_v: ResizeDirection) { this.SetValue(GridSplitter.ResizeDirectionProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly DragDelta = new RoutedEvent<ValueChangedEventArgs<number>>("DragDelta", RoutingStrategy.Bubble);
	public readonly DragCompleted = new RoutedEvent<RoutedEventArgs>("DragCompleted", RoutingStrategy.Bubble);

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 방향을 확정한다. Auto면 붙은 축의 반대.
	// @param _grid: 소속 Grid
	private ResolveDirection(_grid: Grid): ResizeDirection
	{
		if (this.ResizeDirection !== ResizeDirection.Auto)
			return this.ResizeDirection;
		const col = Grid.ColumnProperty.Get(this);
		return col > 0 ? ResizeDirection.Columns : ResizeDirection.Rows;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이전 트랙 요소의 현재 px를 실측한다. 자식 순서가 트랙 순서와 다를 수 있어
	// 붙임 속성으로 트랙을 차지하는 요소를 찾는다(가로지르는 spanned 요소 제외 우선).
	// @param _grid: 소속 Grid
	// @param _isCols: 열이면 true
	// @param _index: 스플리터의 행열 인덱스
	private MeasureSibling(_grid: Grid, _isCols: boolean, _index: number): number
	{
		const prev = _index - 1;
		const at = (_c: UIElement): number => _isCols ? Grid.ColumnProperty.Get(_c) : Grid.RowProperty.Get(_c);
		const span = (_c: UIElement): number => _isCols ? Grid.ColumnSpanProperty.Get(_c) : Grid.RowSpanProperty.Get(_c);
		const target = _grid.Children.find((_c) => at(_c) === prev && span(_c) === 1)
			?? _grid.Children.find((_c) => at(_c) <= prev && prev < at(_c) + span(_c));
		if (target === undefined)
			return 0;
		const rect = target.Element.getBoundingClientRect();
		return _isCols ? rect.width : rect.height;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 드래그 시작. Star면 Pixel로 고정하고 캡처.
	// @param _a: 인자
	private HandleDown(_a: PointerEventArgs): void
	{
		const grid = this.FindAncestor(Grid);
		if (grid === null)
			return;
		this.grid_ = grid;
		const isCols = this.ResolveDirection(grid) === ResizeDirection.Columns;
		if (isCols)
		{
			const index = Grid.ColumnProperty.Get(this);
			this.prevCol_ = grid.ColumnDefinitions.Get(index - 1);
			this.startPos_ = _a.X;
			this.startPrev_ = this.MeasureSibling(grid, true, index);
			if (this.prevCol_.Length.Unit === GridUnitType.Star)
				this.prevCol_.Length = GridLength.Pixel(this.startPrev_);
		}
		else
		{
			const index = Grid.RowProperty.Get(this);
			this.prevRow_ = grid.RowDefinitions.Get(index - 1);
			this.startPos_ = _a.Y;
			this.startPrev_ = this.MeasureSibling(grid, false, index);
			if (this.prevRow_.Length.Unit === GridUnitType.Star)
				this.prevRow_.Length = GridLength.Pixel(this.startPrev_);
		}
		InputDispatcher.Capture(this, _a.PointerId);
		this.Element.classList.add("is-dragging");
		_a.Handled = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 드래그 중. Min/Max로 clamp하고 DragDelta를 쏜다.
	// @param _a: 인자
	private HandleMove(_a: PointerEventArgs): void
	{
		if (this.grid_ === null)
			return;
		const isCols = this.ResolveDirection(this.grid_) === ResizeDirection.Columns;
		const delta = (isCols ? _a.X : _a.Y) - this.startPos_;
		if (isCols && this.prevCol_ !== null)
		{
			const size = Math.min(Math.max(this.startPrev_ + delta, this.prevCol_.MinWidth), this.prevCol_.MaxWidth);
			this.prevCol_.Length = GridLength.Pixel(size);
			this.grid_.InvalidateTemplate();
			this.RaiseEvent(this.DragDelta, new ValueChangedEventArgs<number>(this, this.startPrev_, size));
		}
		else if (!isCols && this.prevRow_ !== null)
		{
			const size = Math.min(Math.max(this.startPrev_ + delta, this.prevRow_.MinHeight), this.prevRow_.MaxHeight);
			this.prevRow_.Length = GridLength.Pixel(size);
			this.grid_.InvalidateTemplate();
			this.RaiseEvent(this.DragDelta, new ValueChangedEventArgs<number>(this, this.startPrev_, size));
		}
		_a.Handled = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 드래그 끝. 캡처 해제하고 DragCompleted를 쏜다.
	// @param _a: 인자
	private HandleUp(_a: PointerEventArgs): void
	{
		InputDispatcher.Release(_a.PointerId);
		this.Element.classList.remove("is-dragging");
		this.RaiseEvent(this.DragCompleted, new RoutedEventArgs(this));
		this.grid_ = null;
		this.prevRow_ = null;
		this.prevCol_ = null;
	}
}
