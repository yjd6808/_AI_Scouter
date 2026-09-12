/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RepeatButton. 누르고 있으면 연속 발화.
*/

import { UIProperty } from "../Core/UIProperty";
import { ButtonBase } from "./ButtonBase";
import { RegisterElement } from "./RegisterElement";

@RegisterElement("RepeatButton")
export class RepeatButton extends ButtonBase
{
	// ==================== 정적 ====================
	public static readonly DelayProperty = UIProperty.Register<number>("Delay", RepeatButton, { Default: 500, Parse: (_text) => Number(_text) });
	public static readonly IntervalProperty = UIProperty.Register<number>("Interval", RepeatButton, { Default: 33, Parse: (_text) => Number(_text) });

	// ==================== 멤버 ====================
	private timer_: ReturnType<typeof setTimeout> | null = null;
	private repeater_: ReturnType<typeof setInterval> | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 반복 버튼을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-repeat");
		this.PointerUp.Add(() =>
		{
			this.StopRepeat();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 타이머를 정리한다.
	protected override OnDispose(): void
	{
		this.StopRepeat();
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 누름 시작 + 즉시 1회 + 지연 후 연속.
	protected override OnClick(): void
	{
		super.OnClick();
		this.StopRepeat();
		this.timer_ = setTimeout(() =>
		{
			this.timer_ = null;
			this.repeater_ = setInterval(() =>
			{
				super.OnClick();
			}, this.GetValue(RepeatButton.IntervalProperty));
		}, this.GetValue(RepeatButton.DelayProperty));
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 반복을 멈춘다. pointerup에서 호출. P4 배선 지점.
	private StopRepeat(): void
	{
		if (this.timer_ !== null)
		{
			clearTimeout(this.timer_);
			this.timer_ = null;
		}
		if (this.repeater_ !== null)
		{
			clearInterval(this.repeater_);
			this.repeater_ = null;
		}
	}
}
