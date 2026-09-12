/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: TreeView·TreeViewItem. 평탄 행·지연 로드 트리.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { Orientation } from "../../Core/UITypes";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { ContentControl } from "../ContentControl";
import { Control } from "../Control";
import { TextBlock } from "../TextBlock";
import { StackPanel } from "../../Panels/StackPanel";
import { RegisterElement } from "../RegisterElement";

export interface ITreeAdapter
{
	HeaderOf(_node: unknown): string;
	ChildrenOf(_node: unknown): unknown[] | null;
	HasChildren(_node: unknown): boolean;
}

export interface ITreeRow
{
	Node: unknown;
	Depth: number;
	Expanded: boolean;
}

@RegisterElement("TreeViewItem")
export class TreeViewItem extends ContentControl
{
	// ==================== 정적 ====================
	public static readonly IsExpandedProperty = UIProperty.Register<boolean>("IsExpanded", TreeViewItem, { Default: false });
	public static readonly IsSelectedProperty = UIProperty.Register<boolean>("IsSelected", TreeViewItem, { Default: false });
	public static readonly DepthProperty = UIProperty.Register<number>("Depth", TreeViewItem, { Default: 0 });
	public static readonly HasChildrenProperty = UIProperty.Register<boolean>("HasChildren", TreeViewItem, { Default: false });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 트리 행을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-treeview__item");
		this.Element.setAttribute("role", "treeitem");
	}

	// ==================== 속성 ====================
	public get IsExpanded(): boolean { return this.GetValue(TreeViewItem.IsExpandedProperty); }
	public set IsExpanded(_v: boolean) { this.SetValue(TreeViewItem.IsExpandedProperty, _v); }
	public get IsSelected(): boolean { return this.GetValue(TreeViewItem.IsSelectedProperty); }
	public set IsSelected(_v: boolean) { this.SetValue(TreeViewItem.IsSelectedProperty, _v); }
	public get Depth(): number { return this.GetValue(TreeViewItem.DepthProperty); }
	public set Depth(_v: number) { this.SetValue(TreeViewItem.DepthProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === TreeViewItem.IsExpandedProperty)
			this.Element.setAttribute("aria-expanded", (_value as boolean) ? "true" : "false");
		else if (_prop === TreeViewItem.IsSelectedProperty)
			this.Element.classList.toggle("is-selected", _value as boolean);
		else if (_prop === TreeViewItem.DepthProperty)
			this.Element.style.setProperty("--depth", String(this.Depth));
		else if (_prop === TreeViewItem.HasChildrenProperty)
			this.Element.classList.toggle("has-children", _value as boolean);
	}
}

@RegisterElement("TreeView")
export class TreeView extends Control
{
	// ==================== 멤버 ====================
	private adapter_: ITreeAdapter | null = null;
	private rows_: ITreeRow[] = [];
	private selected_: unknown = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 트리를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-treeview");
		this.Element.setAttribute("role", "tree");
		this.Element.tabIndex = 0;
		this.Focusable = true;
		this.KeyDown.Add((_s, _a) =>
		{
			this.HandleKey(_a.Key);
		});
		this.PointerDown.Add((_s, _a) =>
		{
			const idx = this.IndexFromEvent(_a.GetPosition(this));
			if (idx < 0)
				return;
			const row = this.rows_[idx];
			if (row === undefined)
				return;
			const native = _a.Native.target as Element | null;
			if (native !== null && typeof native.closest === "function" && native.closest(".gui-treeview__toggle") !== null)
			{
				this.Toggle(idx);
				return;
			}
			this.SelectNode(row.Node);
		});
	}

	// ==================== 속성 ====================
	public get SelectedItem(): unknown { return this.selected_; }
	public get Rows(): ReadonlyArray<ITreeRow> { return this.rows_; }

	// ==================== 이벤트 ====================
	public readonly SelectedItemChanged = new RoutedEvent<RoutedEventArgs>("SelectedItemChanged", RoutingStrategy.Bubble);
	public readonly Expanded = new RoutedEvent<RoutedEventArgs>("Expanded", RoutingStrategy.Bubble);
	public readonly Collapsed = new RoutedEvent<RoutedEventArgs>("Collapsed", RoutingStrategy.Bubble);

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 루트 노드와 어댑터를 깐다.
	// @param _nodes: 루트 노드들
	// @param _adapter: 헤더·자식 어댑터
	public SetItems(_nodes: unknown[], _adapter: ITreeAdapter): void
	{
		this.adapter_ = _adapter;
		this.selected_ = null;
		this.rows_ = _nodes.map((_n) => ({ Node: _n, Depth: 0, Expanded: false }));
		this.RenderRows();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 지연 로드 자식을 꽂는다. 펼침 상태로 연다.
	// @param _node: 부모 노드
	// @param _children: 자식들
	public SetChildren(_node: unknown, _children: unknown[]): void
	{
		if (this.adapter_ === null)
			return;
		const at = this.rows_.findIndex((_r) => _r.Node === _node);
		if (at < 0)
			return;
		const row = this.rows_[at] as ITreeRow;
		const insert: ITreeRow[] = _children.map((_c) => ({ Node: _c, Depth: row.Depth + 1, Expanded: false }));
		this.rows_.splice(at + 1, 0, ...insert);
		row.Expanded = true;
		this.RenderRows();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 노드를 선택한다.
	// @param _node: 노드 (null이면 해제)
	public SelectNode(_node: unknown): void
	{
		if (this.selected_ === _node)
			return;
		this.selected_ = _node;
		for (let idx = 0; idx < this.rows_.length; ++idx)
		{
			const container = this.Children[idx];
			if (container instanceof TreeViewItem)
				container.IsSelected = this.rows_[idx]?.Node === _node;
		}
		this.RaiseEvent(this.SelectedItemChanged, new RoutedEventArgs(this));
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 펼침·접기 토글. 미로드면 Expanded 이벤트로 요청.
	// @param _index: 행 인덱스
	private Toggle(_index: number): void
	{
		const adapter = this.adapter_;
		const row = this.rows_[_index];
		if (adapter === null || row === undefined)
			return;
		if (row.Expanded)
		{
			const depth = row.Depth;
			let end = _index + 1;
			while (end < this.rows_.length && (this.rows_[end]?.Depth ?? 0) > depth)
				end++;
			this.rows_.splice(_index + 1, end - _index - 1);
			row.Expanded = false;
			this.RenderRows();
			this.RaiseEvent(this.Collapsed, new RoutedEventArgs(this));
			return;
		}
		const children = adapter.ChildrenOf(row.Node);
		if (children === null)
		{
			this.RaiseEvent(this.Expanded, new RoutedEventArgs(this));
			return;
		}
		const insert: ITreeRow[] = children.map((_c) => ({ Node: _c, Depth: row.Depth + 1, Expanded: false }));
		this.rows_.splice(_index + 1, 0, ...insert);
		row.Expanded = true;
		this.RenderRows();
		this.RaiseEvent(this.Expanded, new RoutedEventArgs(this));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 목록을 자식으로 그린다.
	private RenderRows(): void
	{
		while (this.Children.length > this.rows_.length)
		{
			const last = this.Children[this.Children.length - 1] as UIElement;
			this.RemoveChild(last, true);
		}
		for (let idx = 0; idx < this.rows_.length; ++idx)
		{
			const row = this.rows_[idx] as ITreeRow;
			let container = this.Children[idx];
			if (!(container instanceof TreeViewItem))
			{
				container = new TreeViewItem();
				this.AddChild(container, idx);
			}
			this.PrepareRow(container as TreeViewItem, row);
		}
		while (this.Children.length > this.rows_.length)
		{
			const last = this.Children[this.Children.length - 1] as UIElement;
			this.RemoveChild(last, true);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행에 헤더·깊이·펼침을 입힌다.
	// @param _container: 행 컨테이너
	// @param _row: 행
	private PrepareRow(_container: TreeViewItem, _row: ITreeRow): void
	{
		const adapter = this.adapter_;
		if (adapter === null)
			return;
		_container.Depth = _row.Depth;
		_container.IsExpanded = _row.Expanded;
		_container.IsSelected = _row.Node === this.selected_;
		_container.SetValue(TreeViewItem.HasChildrenProperty, adapter.HasChildren(_row.Node));
		const content = new StackPanel();
		content.Orientation = Orientation.Horizontal;
		if (adapter.HasChildren(_row.Node))
		{
			const toggle = new TextBlock();
			toggle.Element.classList.add("gui-treeview__toggle");
			toggle.Text = _row.Expanded ? "▾" : "▸";
			content.AddChild(toggle);
		}
		const label = new TextBlock();
		label.Element.classList.add("gui-treeview__label");
		label.Text = adapter.HeaderOf(_row.Node);
		content.AddChild(label);
		_container.Content = content;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키보드 이동. ←→ 펼침·접기, ↑↓ 이동.
	// @param _key: 키
	private HandleKey(_key: string): void
	{
		const current = this.rows_.findIndex((_r) => _r.Node === this.selected_);
		if (_key === "ArrowDown" || _key === "ArrowUp")
		{
			const next = _key === "ArrowDown" ? current + 1 : current - 1;
			const row = this.rows_[current < 0 ? 0 : next];
			if (row !== undefined)
				this.SelectNode(row.Node);
		}
		else if ((_key === "ArrowRight" || _key === "ArrowLeft") && current >= 0)
		{
			const row = this.rows_[current] as ITreeRow;
			if ((_key === "ArrowRight" && !row.Expanded) || (_key === "ArrowLeft" && row.Expanded))
				this.Toggle(current);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 좌표에서 행 인덱스를 찾는다. 고정 28px 가정.
	// @param _pos: 상대 좌표
	private IndexFromEvent(_pos: { X: number; Y: number }): number
	{
		const idx = Math.floor(_pos.Y / 28);
		return idx >= 0 && idx < this.rows_.length ? idx : -1;
	}
}
