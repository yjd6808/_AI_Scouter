/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: DockPanel. 방향이 바뀔 때마다 중첩 slice div를 만들어 WPF Dock 의미를 살린다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Dock } from "../Core/UITypes";
import { Panel } from "./Panel";
import { AttachedProperty } from "./AttachedProperty";

export class DockPanel extends Panel
{
	// ==================== 정적 ====================
	public static readonly LastChildFillProperty = UIProperty.Register<boolean>("LastChildFill", DockPanel, { Default: true });
	public static readonly DockProperty = AttachedProperty.Register<Dock>("DockPanel.Dock", { Default: Dock.Left, Parse: (_text) => _text as Dock });

	// ==================== 멤버 ====================
	private rebuildScheduled_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// dock div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-dock");
	}

	// ==================== 속성 ====================
	public get LastChildFill(): boolean { return this.GetValue(DockPanel.LastChildFillProperty); }
	public set LastChildFill(_v: boolean) { this.SetValue(DockPanel.LastChildFillProperty, _v); }

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식·붙임 변경은 전부 슬라이스 재구성으로 모은다.
	// @param _child: 자식
	protected override ApplyChildLayout(_child: UIElement): void
	{
		this.ScheduleRebuild();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식이 떨어져도 슬라이스를 다시 짠다.
	// @param _child: 자식
	protected override OnChildRemoved(_child: UIElement): void
	{
		this.ScheduleRebuild();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 재구성을 microtask에 예약한다.
	private ScheduleRebuild(): void
	{
		if (this.rebuildScheduled_)
			return;
		this.rebuildScheduled_ = true;
		void Promise.resolve().then(() =>
		{
			this.rebuildScheduled_ = false;
			this.RebuildSlices();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식 순서대로 방향이 바뀔 때마다 slice를 열고 채운다. 논리 Parent는 유지.
	private RebuildSlices(): void
	{
		while (this.Element.firstChild !== null)
			this.Element.firstChild.remove();
		let slice: HTMLDivElement | null = null;
		let sliceDir = "";
		const children = [...this.Children];
		for (let idx = 0; idx < children.length; ++idx)
		{
			const child = children[idx] as UIElement;
			const dock = DockPanel.DockProperty.Get(child);
			const isLast = idx === children.length - 1;
			const dir = isLast && this.LastChildFill ? "fill" : (dock === Dock.Left || dock === Dock.Right ? "row" : "column");
			if (slice === null || sliceDir !== dir)
			{
				slice = document.createElement("div");
				slice.className = `gui-dock-slice is-${dir}`;
				this.Element.append(slice);
				sliceDir = dir;
			}
			slice.append(child.Element);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === DockPanel.LastChildFillProperty)
			this.ScheduleRebuild();
	}
}
