/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: StatusDot. 상태 점. Ok/Warn/Error/Idle/Busy.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { RegisterElement } from "../RegisterElement";

export enum DotStatus
{
	Ok = "Ok",
	Warn = "Warn",
	Error = "Error",
	Idle = "Idle",
	Busy = "Busy",
}

@RegisterElement("StatusDot")
export class StatusDot extends UIElement
{
	// ==================== 정적 ====================
	public static readonly StatusProperty = UIProperty.Register<DotStatus>("Status", StatusDot, { Default: DotStatus.Idle, Parse: (_text) => _text });
	public static readonly PulseProperty = UIProperty.Register<boolean>("Pulse", StatusDot, { Default: false });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 점을 만든다.
	public constructor()
	{
		super("span");
		this.Element.classList.add("gui-dot");
		this.ApplyStatus(this.Status);
	}

	// ==================== 속성 ====================
	public get Status(): DotStatus { return this.GetValue(StatusDot.StatusProperty); }
	public set Status(_v: DotStatus) { this.SetValue(StatusDot.StatusProperty, _v); }

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태 클래스를 갱신한다.
	// @param _status: 상태
	private ApplyStatus(_status: DotStatus): void
	{
		this.Element.classList.remove("is-ok", "is-warn", "is-error", "is-idle", "is-busy");
		this.Element.classList.add(`is-${_status.toLowerCase()}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === StatusDot.StatusProperty)
			this.ApplyStatus(_value as DotStatus);
		else if (_prop === StatusDot.PulseProperty)
			this.Element.classList.toggle("is-pulse", _value as boolean);
	}
}
