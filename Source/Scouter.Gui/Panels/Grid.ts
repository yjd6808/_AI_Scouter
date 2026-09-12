/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Grid 패널. WPF Grid 속성을 CSS grid로 번역한다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Panel } from "./Panel";
import { AttachedProperty } from "./AttachedProperty";
import { GridLength, RowDefinition, ColumnDefinition, DefinitionCollection } from "./GridDefinitions";

export class Grid extends Panel
{
	// ==================== 정적 ====================
	public static readonly RowDefinitionsProperty = UIProperty.Register<string>("RowDefinitions", Grid, { Default: "*" });
	public static readonly ColumnDefinitionsProperty = UIProperty.Register<string>("ColumnDefinitions", Grid, { Default: "*" });
	public static readonly ShowGridLinesProperty = UIProperty.Register<boolean>("ShowGridLines", Grid, { Default: false });

	public static readonly RowProperty = AttachedProperty.Register<number>("Grid.Row", { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly ColumnProperty = AttachedProperty.Register<number>("Grid.Column", { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly RowSpanProperty = AttachedProperty.Register<number>("Grid.RowSpan", { Default: 1, Parse: (_text) => Number(_text) });
	public static readonly ColumnSpanProperty = AttachedProperty.Register<number>("Grid.ColumnSpan", { Default: 1, Parse: (_text) => Number(_text) });

	// ==================== 멤버 ====================
	public readonly RowDefinitions = new DefinitionCollection<RowDefinition>();
	public readonly ColumnDefinitions = new DefinitionCollection<ColumnDefinition>();
	private templateScheduled_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// grid div를 만들고 정의 변경을 템플릿 무효화로 연결한다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-grid");
		this.RowDefinitions.AddChanged(() => { this.InvalidateTemplate(); });
		this.ColumnDefinitions.AddChanged(() => { this.InvalidateTemplate(); });
	}

	// ==================== 속성 ====================
	public get ShowGridLines(): boolean { return this.GetValue(Grid.ShowGridLinesProperty); }
	public set ShowGridLines(_v: boolean) { this.SetValue(Grid.ShowGridLinesProperty, _v); }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 템플릿 갱신을 microtask에 예약한다. 드래그 중 프레임당 1회.
	public InvalidateTemplate(): void
	{
		if (this.templateScheduled_)
			return;
		this.templateScheduled_ = true;
		void Promise.resolve().then(() =>
		{
			this.templateScheduled_ = false;
			this.RebuildTemplate();
		});
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식 1개의 grid-area를 적용한다.
	// @param _child: 자식
	protected override ApplyChildLayout(_child: UIElement): void
	{
		const row = Grid.RowProperty.Get(_child);
		const col = Grid.ColumnProperty.Get(_child);
		const rowSpan = Grid.RowSpanProperty.Get(_child);
		const colSpan = Grid.ColumnSpanProperty.Get(_child);
		_child.Element.style.gridRow = `${row + 1} / span ${rowSpan}`;
		_child.Element.style.gridColumn = `${col + 1} / span ${colSpan}`;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 정의에서 grid-template 문자열을 다시 만든다.
	private RebuildTemplate(): void
	{
		const rows: string[] = [];
		for (let idx = 0; idx < this.RowDefinitions.Count; ++idx)
		{
			const def = this.RowDefinitions.Get(idx);
			rows.push(def.Length.ToCss(0, Number.POSITIVE_INFINITY));
		}
		const cols: string[] = [];
		for (let idx = 0; idx < this.ColumnDefinitions.Count; ++idx)
		{
			const def = this.ColumnDefinitions.Get(idx);
			cols.push(def.Length.ToCss(def.MinWidth, def.MaxWidth));
		}
		if (rows.length > 0)
			this.Element.style.gridTemplateRows = rows.join(" ");
		if (cols.length > 0)
			this.Element.style.gridTemplateColumns = cols.join(" ");
		this.Element.classList.toggle("show-grid-lines", this.ShowGridLines);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다. 정의 문자열이면 파싱 후 템플릿 무효화.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === Grid.RowDefinitionsProperty)
		{
			this.RowDefinitions.Parse(_value as string, (_length: GridLength) => new RowDefinition(_length));
		}
		else if (_prop === Grid.ColumnDefinitionsProperty)
		{
			this.ColumnDefinitions.Parse(_value as string, (_length: GridLength) => new ColumnDefinition(_length));
		}
		else if (_prop === Grid.ShowGridLinesProperty)
		{
			this.Element.classList.toggle("show-grid-lines", _value as boolean);
		}
	}
}
