/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 라우티드 이벤트. Tunnel → Direct → Bubble로 논리 트리를 탄다.
*/

import type { UIElement } from "./UIElement";
import type { IDisposable } from "./Disposable";
import type { IPoint, ISize } from "./UITypes";
import type { UIProperty } from "./UIProperty";

export enum RoutingStrategy
{
	Tunnel = "Tunnel",
	Bubble = "Bubble",
	Direct = "Direct",
}

export class RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly Source: UIElement;
	public OriginalSource: UIElement;
	public Handled = false;
	public readonly Timestamp: number;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 발신 요소로 인자를 만든다.
	// @param _source: 발신 요소
	public constructor(_source: UIElement)
	{
		this.Source = _source;
		this.OriginalSource = _source;
		this.Timestamp = Date.now();
	}
}

export class PointerEventArgs extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly X: number;
	public readonly Y: number;
	public readonly Button: number;
	public readonly Buttons: number;
	public readonly Ctrl: boolean;
	public readonly Shift: boolean;
	public readonly Alt: boolean;
	public readonly PointerId: number;
	public readonly Native: PointerEvent;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 네이티브 포인터 값을 복사한다.
	// @param _source: 발신 요소
	// @param _native: 네이티브 이벤트
	public constructor(_source: UIElement, _native: PointerEvent)
	{
		super(_source);
		this.X = _native.clientX;
		this.Y = _native.clientY;
		this.Button = _native.button;
		this.Buttons = _native.buttons;
		this.Ctrl = _native.ctrlKey;
		this.Shift = _native.shiftKey;
		this.Alt = _native.altKey;
		this.PointerId = _native.pointerId;
		this.Native = _native;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 기준 요소 상대 좌표를 구한다.
	// @param _relativeTo: 기준 요소
	public GetPosition(_relativeTo: UIElement): IPoint
	{
		const rect = _relativeTo.Element.getBoundingClientRect();
		return { X: this.X - rect.left, Y: this.Y - rect.top };
	}
}

export class KeyEventArgs extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly Key: string;
	public readonly Code: string;
	public readonly Ctrl: boolean;
	public readonly Shift: boolean;
	public readonly Alt: boolean;
	public readonly Meta: boolean;
	public readonly IsRepeat: boolean;
	public readonly Native: KeyboardEvent;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 네이티브 키 값을 복사한다.
	// @param _source: 발신 요소
	// @param _native: 네이티브 이벤트
	public constructor(_source: UIElement, _native: KeyboardEvent)
	{
		super(_source);
		this.Key = _native.key;
		this.Code = _native.code;
		this.Ctrl = _native.ctrlKey;
		this.Shift = _native.shiftKey;
		this.Alt = _native.altKey;
		this.Meta = _native.metaKey;
		this.IsRepeat = _native.repeat;
		this.Native = _native;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// "Ctrl+Shift+P" 형식과 일치하는지 본다.
	// @param _chord: 조합 문자열
	public Matches(_chord: string): boolean
	{
		const parts = _chord.split("+").map((_p) => _p.trim().toLowerCase());
		const key = parts[parts.length - 1] as string;
		const want = new Set(parts.slice(0, -1));
		if ((want.has("ctrl")) !== this.Ctrl)
			return false;
		if ((want.has("shift")) !== this.Shift)
			return false;
		if ((want.has("alt")) !== this.Alt)
			return false;
		if (want.has("meta") !== this.Meta && want.has("win") !== this.Meta)
			return false;
		return this.Key.toLowerCase() === key || this.Code.toLowerCase() === key;
	}
}

export class ValueChangedEventArgs<T> extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly OldValue: T;
	public readonly NewValue: T;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이전·새 값을 담는다.
	// @param _source: 발신 요소
	// @param _old: 이전 값
	// @param _next: 새 값
	public constructor(_source: UIElement, _old: T, _next: T)
	{
		super(_source);
		this.OldValue = _old;
		this.NewValue = _next;
	}
}

export class PropertyChangedEventArgs extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly Property: UIProperty<unknown>;
	public readonly OldValue: unknown;
	public readonly NewValue: unknown;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 속성 변경 내역을 담는다.
	// @param _source: 발신 요소
	// @param _prop: 속성
	// @param _old: 이전 값
	// @param _next: 새 값
	public constructor(_source: UIElement, _prop: UIProperty<unknown>, _old: unknown, _next: unknown)
	{
		super(_source);
		this.Property = _prop;
		this.OldValue = _old;
		this.NewValue = _next;
	}
}

export class SizeChangedEventArgs extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly NewSize: ISize;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 새 크기를 담는다.
	// @param _source: 발신 요소
	// @param _size: 새 크기
	public constructor(_source: UIElement, _size: ISize)
	{
		super(_source);
		this.NewSize = _size;
	}
}

export class WheelEventArgs extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly DeltaX: number;
	public readonly DeltaY: number;
	public readonly Ctrl: boolean;
	public readonly Shift: boolean;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 휠 델타를 복사한다.
	// @param _source: 발신 요소
	// @param _native: 네이티브 이벤트
	public constructor(_source: UIElement, _native: WheelEvent)
	{
		super(_source);
		this.DeltaX = _native.deltaX;
		this.DeltaY = _native.deltaY;
		this.Ctrl = _native.ctrlKey;
		this.Shift = _native.shiftKey;
	}
}

export class RoutedEvent<TArgs extends RoutedEventArgs>
{
	// ==================== 멤버 ====================
	public readonly Name: string;
	public readonly Strategy: RoutingStrategy;
	private readonly handlers_: Array<(_sender: UIElement, _args: TArgs) => void> = [];

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름·전략으로 이벤트를 만든다.
	// @param _name: 이름 (요소 필드명과 일치)
	// @param _strategy: 전략
	public constructor(_name: string, _strategy: RoutingStrategy)
	{
		this.Name = _name;
		this.Strategy = _strategy;
	}

	// ==================== 속성 ====================
	public get HasHandlers(): boolean { return this.handlers_.length > 0; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 핸들러를 추가한다. 반환 Disposable로 제거.
	// @param _handler: 핸들러
	public Add(_handler: (_sender: UIElement, _args: TArgs) => void): IDisposable
	{
		this.handlers_.push(_handler);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				const idx = this.handlers_.indexOf(_handler);
				if (idx >= 0)
					this.handlers_.splice(idx, 1);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 핸들러를 제거한다.
	// @param _handler: 핸들러
	public Remove(_handler: (_sender: UIElement, _args: TArgs) => void): void
	{
		const idx = this.handlers_.indexOf(_handler);
		if (idx >= 0)
			this.handlers_.splice(idx, 1);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록된 전 핸들러를 호출한다. 라우팅은 UIElement.RaiseEvent가 담당.
	// @param _sender: 발신 요소
	// @param _args: 인자
	public Invoke(_sender: UIElement, _args: TArgs): void
	{
		for (const handler of [...this.handlers_])
		{
			handler(_sender, _args);
			if (_args.Handled)
				break;
		}
	}
}
