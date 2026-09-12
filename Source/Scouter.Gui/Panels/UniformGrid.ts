/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UniformGrid. 균등 격자 번역이다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Panel } from "./Panel";

export class UniformGrid extends Panel
{
	// ==================== 정적 ====================
	public static readonly RowsProperty = UIProperty.Register<number>("Rows", UniformGrid, { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly ColumnsProperty = UIProperty.Register<number>("Columns", UniformGrid, { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly FirstColumnProperty = UIProperty.Register<number>("FirstColumn", UniformGrid, { Default: 0, Parse: (_text) => Number(_text) });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// grid div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-uniform");
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식이 붙을 때마다 행열을 다시 계산한다.
	// @param _child: 자식
	protected override ApplyChildLayout(_child: UIElement): void
	{
		this.RefreshTemplate();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식이 떨어져도 다시 계산한다.
	// @param _child: 자식
	protected override OnChildRemoved(_child: UIElement): void
	{
		this.RefreshTemplate();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 0인 축은 자식 수로 채운다.
	private RefreshTemplate(): void
	{
		let rows = this.GetValue(UniformGrid.RowsProperty);
		let cols = this.GetValue(UniformGrid.ColumnsProperty);
		const count = Math.max(this.Children.length, 1);
		if (rows === 0 && cols === 0)
		{
			rows = Math.ceil(Math.sqrt(count));
			cols = Math.ceil(count / rows);
		}
		else if (rows === 0)
		{
			rows = Math.ceil(count / cols);
		}
		else if (cols === 0)
		{
			cols = Math.ceil(count / rows);
		}
		this.Element.style.gridTemplate = `repeat(${rows}, 1fr) / repeat(${cols}, 1fr)`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === UniformGrid.RowsProperty || _prop === UniformGrid.ColumnsProperty)
			this.RefreshTemplate();
	}
}
