/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RangeBase·ProgressBar·Slider·NumericUpDown. 값 범위 계열.
*/

import { UIProperty } from "../Core/UIProperty";
import { RoutedEvent, ValueChangedEventArgs, RoutingStrategy } from "../Core/RoutedEvent";
import { Control } from "./Control";
import { RegisterElement } from "./RegisterElement";
import { TextBox } from "./TextBox";
import { RepeatButton } from "./RepeatButton";

export abstract class RangeBase extends Control
{
	// ==================== 정적 ====================
	public static readonly MinimumProperty = UIProperty.Register<number>("Minimum", RangeBase, { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly MaximumProperty = UIProperty.Register<number>("Maximum", RangeBase, { Default: 100, Parse: (_text) => Number(_text) });
	public static readonly ValueProperty = UIProperty.Register<number>("Value", RangeBase, { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly SmallChangeProperty = UIProperty.Register<number>("SmallChange", RangeBase, { Default: 1, Parse: (_text) => Number(_text) });
	public static readonly LargeChangeProperty = UIProperty.Register<number>("LargeChange", RangeBase, { Default: 10, Parse: (_text) => Number(_text) });

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 범위 뼈대를 만든다.
	protected constructor()
	{
		super();
	}

	// ==================== 속성 ====================
	public get Minimum(): number { return this.GetValue(RangeBase.MinimumProperty); }
	public set Minimum(_v: number) { this.SetValue(RangeBase.MinimumProperty, _v); }
	public get Maximum(): number { return this.GetValue(RangeBase.MaximumProperty); }
	public set Maximum(_v: number) { this.SetValue(RangeBase.MaximumProperty, _v); }
	public get Value(): number { return this.GetValue(RangeBase.ValueProperty); }
	public set Value(_v: number) { this.SetValue(RangeBase.ValueProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly ValueChanged = new RoutedEvent<ValueChangedEventArgs<number>>("ValueChanged", RoutingStrategy.Bubble);

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Value 변경을 이벤트로 알린다.
	// @param _prop: 속성
	// @param _old: 이전값
	// @param _next: 새값
	protected override OnPropertyChanged(_prop: UIProperty<unknown>, _old: unknown, _next: unknown): void
	{
		if (_prop === RangeBase.ValueProperty)
			this.RaiseValueChanged(_old as number, _next as number);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 범위로 보정한다. 설정 순서 무관.
	// @param _v: 후보값
	protected CoerceValue(_v: number): number
	{
		const lo = Math.min(this.Minimum, this.Maximum);
		const hi = Math.max(this.Minimum, this.Maximum);
		return Math.min(Math.max(_v, lo), hi);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값 변경을 자식에게 알린다. SetValue 후처리.
	// @param _old: 이전값
	// @param _next: 새값
	protected RaiseValueChanged(_old: number, _next: number): void
	{
		if (!Object.is(_old, _next))
			this.RaiseEvent(this.ValueChanged, new ValueChangedEventArgs<number>(this, _old, _next));
	}
}

@RegisterElement("ProgressBar")
export class ProgressBar extends RangeBase
{
	// ==================== 정적 ====================
	public static readonly IsIndeterminateProperty = UIProperty.Register<boolean>("IsIndeterminate", ProgressBar, { Default: false });

	// ==================== 멤버 ====================
	private readonly fill_: HTMLDivElement;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 트랙+채움을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-progress");
		this.Element.setAttribute("role", "progressbar");
		this.fill_ = document.createElement("div");
		this.fill_.className = "gui-progress__fill";
		this.Element.append(this.fill_);
		this.Refresh();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 채움 폭을 갱신한다.
	private Refresh(): void
	{
		const span = this.Maximum - this.Minimum;
		const ratio = span <= 0 ? 0 : (this.Value - this.Minimum) / span;
		this.fill_.style.width = `${Math.round(ratio * 100)}%`;
		this.Element.classList.toggle("is-indeterminate", this.GetValue(ProgressBar.IsIndeterminateProperty));
		this.Element.setAttribute("aria-valuenow", String(this.Value));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === RangeBase.ValueProperty || _prop === RangeBase.MinimumProperty || _prop === RangeBase.MaximumProperty || _prop === ProgressBar.IsIndeterminateProperty)
			this.Refresh();
	}
}

@RegisterElement("Slider")
export class Slider extends RangeBase
{
	// ==================== 정적 ====================
	public static readonly TickFrequencyProperty = UIProperty.Register<number>("TickFrequency", Slider, { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly IsSnapToTickEnabledProperty = UIProperty.Register<boolean>("IsSnapToTickEnabled", Slider, { Default: false });

	// ==================== 멤버 ====================
	private readonly input_: HTMLInputElement;
	private syncing_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 네이티브 range를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-slider");
		this.input_ = document.createElement("input");
		this.input_.setAttribute("type", "range");
		this.Element.append(this.input_);
		this.input_.addEventListener("input", () =>
		{
			this.syncing_ = true;
			this.Value = this.Snap(Number(this.input_.value));
			this.syncing_ = false;
		});
		this.Refresh();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 틱에 맞춘다.
	// @param _v: 후보값
	private Snap(_v: number): number
	{
		const tick = this.GetValue(Slider.TickFrequencyProperty);
		if (this.GetValue(Slider.IsSnapToTickEnabledProperty) && tick > 0)
			return Math.round(_v / tick) * tick;
		return _v;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 네이티브 값을 갱신한다.
	private Refresh(): void
	{
		if (this.syncing_)
			return;
		this.input_.min = String(this.Minimum);
		this.input_.max = String(this.Maximum);
		this.input_.value = String(this.Value);
		this.Element.setAttribute("aria-valuenow", String(this.Value));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다. 값은 보정 후 이벤트.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === RangeBase.ValueProperty)
		{
			const coerced = this.CoerceValue(_value as number);
			if (!Object.is(coerced, _value))
			{
				this.SetValue(RangeBase.ValueProperty, coerced);
				return;
			}
			this.Refresh();
		}
		else if (_prop === RangeBase.MinimumProperty || _prop === RangeBase.MaximumProperty)
		{
			this.Value = this.CoerceValue(this.Value);
			this.Refresh();
		}
	}
}

@RegisterElement("NumericUpDown")
export class NumericUpDown extends RangeBase
{
	// ==================== 멤버 ====================
	private readonly text_: TextBox;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트+스핀 버튼을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-numeric");
		this.text_ = new TextBox();
		const up = new RepeatButton();
		up.Content = "▲";
		const down = new RepeatButton();
		down.Content = "▼";
		up.Click.Add(() =>
		{
			this.Value = this.Value + 1;
		});
		down.Click.Add(() =>
		{
			this.Value = this.Value - 1;
		});
		this.AddChild(this.text_);
		this.AddChild(up);
		this.AddChild(down);
		this.text_.TextCommitted.Add(() =>
		{
			const num = Number(this.text_.Text);
			if (!Number.isNaN(num))
				this.Value = this.CoerceValue(num);
		});
		this.Refresh();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트를 갱신한다.
	private Refresh(): void
	{
		this.text_.Text = String(this.Value);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === RangeBase.ValueProperty)
		{
			const coerced = this.CoerceValue(_value as number);
			if (!Object.is(coerced, _value))
			{
				this.SetValue(RangeBase.ValueProperty, coerced);
				return;
			}
			this.Refresh();
		}
	}
}
