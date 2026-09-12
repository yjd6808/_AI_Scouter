/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ListView·GridView. 열 공유 CSS 변수 + 헤더 정렬·리사이즈.
*/

import { UIElement } from "../../Core/UIElement";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { RegisterElement } from "../RegisterElement";
import { UIValues } from "../../Xml/UIValue";
import { ListBox } from "./ListBox";

export interface IGridViewColumnDef
{
	Header: string;
	DisplayMemberPath: string;
	Width: number | "*" | "Auto";
	MinWidth: number;
}

export class GridViewColumn
{
	// ==================== 멤버 ====================
	public Header: string;
	public DisplayMemberPath: string;
	public Width: number | "*" | "Auto";
	public MinWidth: number;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 열 정의 1개를 만든다.
	// @param _def: 정의
	public constructor(_def: IGridViewColumnDef)
	{
		this.Header = _def.Header;
		this.DisplayMemberPath = _def.DisplayMemberPath;
		this.Width = _def.Width;
		this.MinWidth = _def.MinWidth;
	}
}

export class GridView
{
	// ==================== 멤버 ====================
	public readonly Columns: GridViewColumn[] = [];

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 열을 추가한다.
	// @param _col: 열
	public AddColumn(_col: GridViewColumn): void
	{
		this.Columns.push(_col);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 열 템플릿 문자열을 만든다. 헤더·행이 공유.
	public Template(): string
	{
		return this.Columns.map((_col) =>
		{
			if (typeof _col.Width === "number")
				return `${Math.max(_col.Width, _col.MinWidth)}px`;
			if (_col.Width === "*")
				return `minmax(${_col.MinWidth}px,1fr)`;
			return "max-content";
		}).join(" ");
	}
}

export class GridViewHeaderArgs extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly Column: number;
	public Ascending: boolean;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더 클릭 인자.
	// @param _source: 발신 요소
	// @param _column: 열 인덱스
	// @param _ascending: 오름차순 여부
	public constructor(_source: UIElement, _column: number, _ascending: boolean)
	{
		super(_source);
		this.Column = _column;
		this.Ascending = _ascending;
	}
}

@RegisterElement("ListView")
export class ListView extends ListBox
{
	// ==================== 멤버 ====================
	private view_: GridView | null = null;
	private readonly header_: HTMLDivElement;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더+본문을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-listview");
		this.header_ = document.createElement("div");
		this.header_.className = "gui-gridview__header";
		this.Element.prepend(this.header_);
	}

	// ==================== 속성 ====================
	public get View(): GridView | null { return this.view_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 뷰를 교체한다. 헤더·열 템플릿을 다시 만든다.
	public set View(_v: GridView | null)
	{
		this.view_ = _v;
		this.RebuildHeader();
		this.ApplyColumns();
	}

	// ==================== 이벤트 ====================
	public readonly ColumnHeaderClick = new RoutedEvent<GridViewHeaderArgs>("ColumnHeaderClick", RoutingStrategy.Bubble);
	public readonly ColumnResized = new RoutedEvent<RoutedEventArgs>("ColumnResized", RoutingStrategy.Bubble);

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 행은 grid 템플릿을 쓴다.
	// @param _index: 인덱스
	protected override GetContainer(_index: number): UIElement
	{
		const row = new GridViewRow();
		const content = super.GetContainer(_index);
		row.Content = content;
		return row;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더 셀을 다시 만든다. 클릭 정렬 + 그립 리사이즈.
	private RebuildHeader(): void
	{
		while (this.header_.firstChild !== null)
			this.header_.firstChild.remove();
		if (this.view_ === null)
			return;
		this.view_.Columns.forEach((_col, _idx) =>
		{
			const cell = document.createElement("button");
			cell.className = "gui-gridview__headercell";
			cell.textContent = _col.Header;
			cell.addEventListener("click", () =>
			{
				this.OnHeaderClick(_idx);
			});
			const grip = document.createElement("span");
			grip.className = "gui-gridview__grip";
			grip.addEventListener("pointerdown", (_e) =>
			{
				this.OnGripDown(_e, _idx);
			});
			cell.append(grip);
			this.header_.append(cell);
		});
		this.ApplyColumns();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더 클릭. Handled 아니면 기본 정렬.
	// @param _index: 열 인덱스
	private OnHeaderClick(_index: number): void
	{
		if (this.view_ === null)
			return;
		const args = new GridViewHeaderArgs(this, _index, true);
		this.RaiseEvent(this.ColumnHeaderClick, args);
		if (args.Handled)
			return;
		const col = this.view_.Columns[_index] as GridViewColumn;
		const path = col.DisplayMemberPath;
		const sorted = [...this.Items].sort((_a, _b) =>
		{
			const left = UIValues.ToText(((_a as Record<string, unknown>)[path]));
			const right = UIValues.ToText(((_b as Record<string, unknown>)[path]));
			return left.localeCompare(right, "ko");
		});
		this.SetItems(sorted);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그립 드래그 시작. 캡처 후 이동마다 열 폭 갱신.
	// @param _e: 네이티브 이벤트
	// @param _index: 열 인덱스
	private OnGripDown(_e: PointerEvent, _index: number): void
	{
		if (this.view_ === null)
			return;
		_e.stopPropagation();
		const col = this.view_.Columns[_index] as GridViewColumn;
		const startX = _e.clientX;
		const startW = typeof col.Width === "number" ? col.Width : col.MinWidth;
		const move = (_m: PointerEvent): void =>
		{
			col.Width = Math.max(col.MinWidth, startW + (_m.clientX - startX));
			this.ApplyColumns();
		};
		const up = (): void =>
		{
			document.removeEventListener("pointermove", move);
			document.removeEventListener("pointerup", up);
			this.RaiseEvent(this.ColumnResized, new RoutedEventArgs(this));
		};
		document.addEventListener("pointermove", move);
		document.addEventListener("pointerup", up);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 열 템플릿 CSS 변수 1개를 갱신한다.
	private ApplyColumns(): void
	{
		if (this.view_ === null)
			return;
		this.Element.style.setProperty("--gui-grid-columns", this.view_.Template());
	}
}

class GridViewRow extends UIElement
{
	// ==================== 멤버 ====================
	private content_: UIElement | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-gridview__row");
	}

	// ==================== 속성 ====================
	public get Content(): UIElement | null { return this.content_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 내용을 교체한다. 이전 내용은 살린다.
	public set Content(_v: UIElement | null)
	{
		if (this.content_ !== null)
			this.RemoveChild(this.content_, false);
		this.content_ = _v;
		if (_v !== null)
			this.AddChild(_v);
	}
}
