/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: DataGrid. 읽기 전용 자동 열 그리드. ListView 재사용.
*/

import { UIProperty } from "../../Core/UIProperty";
import { RegisterElement } from "../RegisterElement";
import { ListView, GridView, GridViewColumn } from "./ListView";

@RegisterElement("DataGrid")
export class DataGrid extends ListView
{
	// ==================== 정적 ====================
	public static readonly AutoGenerateColumnsProperty = UIProperty.Register<boolean>("AutoGenerateColumns", DataGrid, { Default: true });
	public static readonly CanUserSortColumnsProperty = UIProperty.Register<boolean>("CanUserSortColumns", DataGrid, { Default: true });
	public static readonly CanUserResizeColumnsProperty = UIProperty.Register<boolean>("CanUserResizeColumns", DataGrid, { Default: true });
	public static readonly IsReadOnlyProperty = UIProperty.Register<boolean>("IsReadOnly", DataGrid, { Default: true });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 그리드를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-datagrid");
		this.Element.setAttribute("role", "grid");
		this.ColumnHeaderClick.Add((_s, _a) =>
		{
			if (!this.CanUserSortColumns)
				_a.Handled = true;
		});
	}

	// ==================== 속성 ====================
	public get AutoGenerateColumns(): boolean { return this.GetValue(DataGrid.AutoGenerateColumnsProperty); }
	public set AutoGenerateColumns(_v: boolean) { this.SetValue(DataGrid.AutoGenerateColumnsProperty, _v); }
	public get CanUserSortColumns(): boolean { return this.GetValue(DataGrid.CanUserSortColumnsProperty); }
	public set CanUserSortColumns(_v: boolean) { this.SetValue(DataGrid.CanUserSortColumnsProperty, _v); }
	public get IsReadOnly(): boolean { return this.GetValue(DataGrid.IsReadOnlyProperty); }
	public set IsReadOnly(_v: boolean) { this.SetValue(DataGrid.IsReadOnlyProperty, _v); }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 행을 깐다. 자동 열이면 첫 행 키로 열을 만든다.
	// @param _items: 행 객체들
	public override SetItems(_items: ReadonlyArray<unknown>): void
	{
		if (this.AutoGenerateColumns && this.View === null)
			this.BuildColumns(_items);
		super.SetItems(_items);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 리사이즈 플래그를 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === DataGrid.CanUserResizeColumnsProperty)
			this.Element.classList.toggle("no-resize", !(_value as boolean));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 첫 행 키로 열을 만든다.
	// @param _items: 행 객체들
	private BuildColumns(_items: ReadonlyArray<unknown>): void
	{
		const first = _items[0];
		if (typeof first !== "object" || first === null)
			return;
		const view = new GridView();
		for (const key of Object.keys(first))
			view.AddColumn(new GridViewColumn({ Header: key, DisplayMemberPath: key, Width: "Auto", MinWidth: 40 }));
		this.View = view;
	}
}
