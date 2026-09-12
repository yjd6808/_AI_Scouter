/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Popup. Popup 레이어 절대 배치. 화면 밖이면 뒤집는다.
*/

import { UIElement } from "../../Core/UIElement";
import { UIProperty } from "../../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { UIManager } from "../../Host/UIManager";
import { UILayerKind } from "../../Host/UILayer";

export type PlacementKind = "Bottom" | "Top" | "Right" | "Left" | "Mouse";

export interface IPlacementRect
{
	X: number;
	Y: number;
	Width: number;
	Height: number;
}

export class PopupPlacer
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 배치 rect를 계산한다. 화면 이탈 시 반대쪽으로 뒤집고 좌우는 clamp.
	// @param _target: 앵커 rect
	// @param _size: 팝업 크기
	// @param _placement: 배치
	// @param _ox: 가로 오프셋
	// @param _oy: 세로 오프셋
	public static Compute(_target: DOMRect, _size: { Width: number; Height: number }, _placement: PlacementKind, _ox: number, _oy: number): IPlacementRect
	{
		const vw = window.visualViewport?.width ?? window.innerWidth;
		const vh = window.visualViewport?.height ?? window.innerHeight;
		let x = _target.left + _ox;
		let y = _target.bottom + _oy;
		if (_placement === "Bottom" && y + _size.Height > vh)
			y = _target.top - _size.Height - _oy;
		else if (_placement === "Top")
			y = _target.top - _size.Height - _oy;
		else if (_placement === "Right")
		{
			x = _target.right + _ox;
			y = _target.top + _oy;
		}
		else if (_placement === "Left")
		{
			x = _target.left - _size.Width - _ox;
			y = _target.top + _oy;
		}
		else if (_placement === "Mouse")
		{
			x = _target.left + _ox;
			y = _target.top + _oy;
		}
		return { X: Math.max(0, Math.min(x, vw - _size.Width)), Y: Math.max(0, Math.min(y, vh - _size.Height)), Width: _size.Width, Height: _size.Height };
	}
}

export class Popup extends UIElement
{
	// ==================== 정적 ====================
	public static readonly IsOpenProperty = UIProperty.Register<boolean>("IsOpen", Popup, { Default: false });
	public static readonly PlacementProperty = UIProperty.Register<PlacementKind>("Placement", Popup, { Default: "Bottom" });
	public static readonly StaysOpenProperty = UIProperty.Register<boolean>("StaysOpen", Popup, { Default: true });

	// ==================== 멤버 ====================
	private anchor_: UIElement | null = null;
	private outside_: ((_e: PointerEvent) => void) | null = null;
	private onKey_: ((_e: KeyboardEvent) => void) | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 팝업 div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-popup");
	}

	// ==================== 속성 ====================
	public get IsOpen(): boolean { return this.GetValue(Popup.IsOpenProperty); }
	public set IsOpen(_v: boolean) { this.SetValue(Popup.IsOpenProperty, _v); }
	public get StaysOpen(): boolean { return this.GetValue(Popup.StaysOpenProperty); }
	public set StaysOpen(_v: boolean) { this.SetValue(Popup.StaysOpenProperty, _v); }
	public get PlacementTarget(): UIElement | null { return this.anchor_; }
	public set PlacementTarget(_v: UIElement | null) { this.anchor_ = _v; }

	// ==================== 이벤트 ====================
	public readonly Opened = new RoutedEvent<RoutedEventArgs>("Opened", RoutingStrategy.Direct);
	public readonly Closed = new RoutedEvent<RoutedEventArgs>("Closed", RoutingStrategy.Direct);

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 열기·닫기를 레이어에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop !== Popup.IsOpenProperty)
			return;
		if (_value === true)
			this.OpenNow();
		else
			this.CloseNow();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 레이어에 올리고 배치한다.
	private OpenNow(): void
	{
		const layer = UIManager.LayerElement(UILayerKind.Popup);
		if (layer === null)
			return;
		layer.append(this.Element);
		this.Place();
		this.Element.classList.add("is-open");
		if (!this.GetValue(Popup.StaysOpenProperty))
		{
			this.outside_ = (_e) =>
			{
				if (!this.Element.contains(_e.target as Node))
					this.IsOpen = false;
			};
			this.onKey_ = (_e) =>
			{
				if (_e.key === "Escape")
					this.IsOpen = false;
			};
			document.addEventListener("pointerdown", this.outside_, { capture: true });
			document.addEventListener("keydown", this.onKey_, { capture: true });
		}
		this.RaiseEvent(this.Opened, new RoutedEventArgs(this));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 레이어에서 내린다.
	private CloseNow(): void
	{
		if (this.outside_ !== null)
		{
			document.removeEventListener("pointerdown", this.outside_, { capture: true });
			this.outside_ = null;
		}
		if (this.onKey_ !== null)
		{
			document.removeEventListener("keydown", this.onKey_, { capture: true });
			this.onKey_ = null;
		}
		this.Element.classList.remove("is-open");
		this.Element.remove();
		this.RaiseEvent(this.Closed, new RoutedEventArgs(this));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 앵커 기준으로 위치를 잡는다.
	private Place(): void
	{
		if (this.anchor_ === null)
			return;
		const target = this.anchor_.Element.getBoundingClientRect();
		const size = { Width: this.Element.offsetWidth, Height: this.Element.offsetHeight };
		const rect = PopupPlacer.Compute(target, size, this.GetValue(Popup.PlacementProperty), 0, 0);
		this.Element.style.left = `${rect.X}px`;
		this.Element.style.top = `${rect.Y}px`;
	}
}
