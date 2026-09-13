/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RepeatButton. 누르고 있으면 연속 발화.
*/

import { UIProperty } from "../Core/UIProperty";
import type { PointerEventArgs } from "../Core/RoutedEvent";
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
	// 반복 버튼을 만든다. 누름에만 반복을 건다. 키·합성은 단발이다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-repeat");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 타이머를 정리한다.
	protected override OnDispose(): void
	{
		this.StopRepeat();
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 누름에 반복을 건다. base가 Handled를 세우므로 핸들러 추가가 아니라 오버라이드다.
	// @param _a: 인자
	protected override HandleDown(_a: PointerEventArgs): void
	{
		super.HandleDown(_a);
		this.StartRepeat();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 뗌에 반복을 걷는다.
	// @param _a: 인자
	protected override HandleUp(_a: PointerEventArgs): void
	{
		super.HandleUp(_a);
		this.StopRepeat();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 지연 후 연속 발화를 건다.
	private StartRepeat(): void
	{
		this.StopRepeat();
		this.timer_ = setTimeout(() =>
		{
			this.timer_ = null;
			this.repeater_ = setInterval(() =>
			{
				if (!this.IsEnabled)
				{
					this.StopRepeat();
					return;
				}
				this.OnClick();
			}, this.GetValue(RepeatButton.IntervalProperty));
		}, this.GetValue(RepeatButton.DelayProperty));
	}

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
