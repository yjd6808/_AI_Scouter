/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 루트 DOM 리스너 1세트. 잡은 이벤트를 논리 트리로 라우팅한다.
*/

import { ElementRegistry } from "./ElementRegistry";
import type { UIElement } from "./UIElement";
import { PointerEventArgs, KeyEventArgs, WheelEventArgs, RoutedEventArgs, RoutedEvent } from "./RoutedEvent";

export class InputDispatcher
{
	// ==================== 정적 ====================
	private static s_root_: UIElement | null = null;
	private static s_rootDom_: HTMLElement | null = null;
	private static s_captures_ = new Map<number, UIElement>();
	private static s_hovered_: UIElement | null = null;
	private static s_attached_ = false;
	private static s_onPointer_: ((_e: PointerEvent) => void) | null = null;
	private static s_onHover_: ((_e: PointerEvent) => void) | null = null;
	private static s_onKey_: ((_e: KeyboardEvent) => void) | null = null;
	private static s_onWheel_: ((_e: WheelEvent) => void) | null = null;
	private static s_onFocus_: ((_e: FocusEvent) => void) | null = null;
	private static s_onContextMenu_: ((_e: MouseEvent) => void) | null = null;

	// ==================== 속성 ====================
	public static get Hovered(): UIElement | null { return InputDispatcher.s_hovered_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 루트에 캡처 리스너를 단다.
	// @param _rootDom: 루트 DOM
	// @param _root: 루트 요소
	public static Attach(_rootDom: HTMLElement, _root: UIElement): void
	{
		if (InputDispatcher.s_attached_)
			InputDispatcher.Detach();
		InputDispatcher.s_root_ = _root;
		InputDispatcher.s_rootDom_ = _rootDom;
		InputDispatcher.s_onPointer_ ??= (_e) => { InputDispatcher.OnPointer(_e); };
		InputDispatcher.s_onHover_ ??= (_e) => { InputDispatcher.OnHover(_e); };
		InputDispatcher.s_onKey_ ??= (_e) => { InputDispatcher.OnKey(_e); };
		InputDispatcher.s_onWheel_ ??= (_e) => { InputDispatcher.OnWheel(_e); };
		InputDispatcher.s_onFocus_ ??= (_e) => { InputDispatcher.OnFocus(_e); };
		InputDispatcher.s_onContextMenu_ ??= (_e) => { InputDispatcher.OnContextMenu(_e); };
		const opts: AddEventListenerOptions = { capture: true, passive: false };
		_rootDom.addEventListener("pointerdown", InputDispatcher.s_onPointer_, opts);
		_rootDom.addEventListener("pointerup", InputDispatcher.s_onPointer_, opts);
		_rootDom.addEventListener("pointermove", InputDispatcher.s_onPointer_, opts);
		_rootDom.addEventListener("pointerover", InputDispatcher.s_onHover_, opts);
		_rootDom.addEventListener("pointerout", InputDispatcher.s_onHover_, opts);
		_rootDom.addEventListener("keydown", InputDispatcher.s_onKey_, opts);
		_rootDom.addEventListener("keyup", InputDispatcher.s_onKey_, opts);
		_rootDom.addEventListener("wheel", InputDispatcher.s_onWheel_, opts);
		_rootDom.addEventListener("focusin", InputDispatcher.s_onFocus_, opts);
		_rootDom.addEventListener("focusout", InputDispatcher.s_onFocus_, opts);
		_rootDom.addEventListener("contextmenu", InputDispatcher.s_onContextMenu_, opts);
		InputDispatcher.s_attached_ = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 리스너를 뗀다.
	public static Detach(): void
	{
		const dom = InputDispatcher.s_rootDom_;
		if (dom !== null)
		{
			if (InputDispatcher.s_onPointer_ !== null)
			{
				dom.removeEventListener("pointerdown", InputDispatcher.s_onPointer_, { capture: true });
				dom.removeEventListener("pointerup", InputDispatcher.s_onPointer_, { capture: true });
				dom.removeEventListener("pointermove", InputDispatcher.s_onPointer_, { capture: true });
			}
			if (InputDispatcher.s_onHover_ !== null)
			{
				dom.removeEventListener("pointerover", InputDispatcher.s_onHover_, { capture: true });
				dom.removeEventListener("pointerout", InputDispatcher.s_onHover_, { capture: true });
			}
			if (InputDispatcher.s_onKey_ !== null)
			{
				dom.removeEventListener("keydown", InputDispatcher.s_onKey_, { capture: true });
				dom.removeEventListener("keyup", InputDispatcher.s_onKey_, { capture: true });
			}
			if (InputDispatcher.s_onWheel_ !== null)
				dom.removeEventListener("wheel", InputDispatcher.s_onWheel_, { capture: true });
			if (InputDispatcher.s_onFocus_ !== null)
			{
				dom.removeEventListener("focusin", InputDispatcher.s_onFocus_, { capture: true });
				dom.removeEventListener("focusout", InputDispatcher.s_onFocus_, { capture: true });
			}
			if (InputDispatcher.s_onContextMenu_ !== null)
				dom.removeEventListener("contextmenu", InputDispatcher.s_onContextMenu_, { capture: true });
		}
		InputDispatcher.s_root_ = null;
		InputDispatcher.s_rootDom_ = null;
		InputDispatcher.s_captures_.clear();
		InputDispatcher.s_hovered_ = null;
		InputDispatcher.s_attached_ = false;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 포인터 캡처를 건다. GridSplitter·Slider가 사용.
	// @param _element: 대상 요소
	// @param _pointerId: 포인터 ID
	public static Capture(_element: UIElement, _pointerId: number): void
	{
		InputDispatcher.s_captures_.set(_pointerId, _element);
		try
		{
			_element.Element.setPointerCapture(_pointerId);
		}
		catch
		{
			return;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 캡처를 푼다.
	// @param _pointerId: 포인터 ID
	public static Release(_pointerId: number): void
	{
		InputDispatcher.s_captures_.delete(_pointerId);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// DOM 타입에서 Preview/본 이벤트 쌍을 구한다.
	// @param _type: DOM 타입
	private static PairFor(_type: string): [string, string]
	{
		switch (_type)
		{
			case "pointerdown": return ["PreviewPointerDown", "PointerDown"];
			case "pointerup": return ["PreviewPointerUp", "PointerUp"];
			default: return ["PreviewPointerMove", "PointerMove"];
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 포인터 라우팅 본체.
	// @param _e: 네이티브 이벤트
	private static OnPointer(_e: PointerEvent): void
	{
		const captured = InputDispatcher.s_captures_.get(_e.pointerId);
		const target = captured ?? ElementRegistry.FromEventTarget(_e.target);
		if (target === null)
			return;
		const [preview, main] = InputDispatcher.PairFor(_e.type);
		const args = new PointerEventArgs(target, _e);
		const events = target as unknown as Record<string, RoutedEvent<PointerEventArgs>>;
		target.RaiseEvent(events[preview] as RoutedEvent<PointerEventArgs>, args);
		if (!args.Handled)
			target.RaiseEvent(events[main] as RoutedEvent<PointerEventArgs>, args);
		if (args.Handled && _e.cancelable)
			_e.preventDefault();
		if (_e.type === "pointerup" || _e.type === "pointercancel")
			InputDispatcher.s_captures_.delete(_e.pointerId);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// hover 구간 계산. 공통 조상을 제외한 구간만 Leave → Enter.
	// @param _e: 네이티브 이벤트
	private static OnHover(_e: PointerEvent): void
	{
		const next = ElementRegistry.FromEventTarget(_e.target);
		const prev = InputDispatcher.s_hovered_;
		if (prev === next)
			return;
		InputDispatcher.s_hovered_ = next;
		if (prev !== null)
			prev.RaiseEvent(prev.PointerLeave, new PointerEventArgs(prev, _e));
		if (next !== null)
			next.RaiseEvent(next.PointerEnter, new PointerEventArgs(next, _e));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 라우팅. target은 activeElement 요소, 없으면 root.
	// @param _e: 네이티브 이벤트
	private static OnKey(_e: KeyboardEvent): void
	{
		const active = document.activeElement;
		const target = (active instanceof Element ? ElementRegistry.FromEventTarget(active) : null) ?? InputDispatcher.s_root_;
		if (target === null)
			return;
		const args = new KeyEventArgs(target, _e);
		if (_e.type === "keydown")
		{
			target.RaiseEvent(target.PreviewKeyDown, args);
			if (!args.Handled)
				target.RaiseEvent(target.KeyDown, args);
		}
		else
		{
			target.RaiseEvent(target.PreviewKeyUp, args);
			if (!args.Handled)
				target.RaiseEvent(target.KeyUp, args);
		}
		if (args.Handled && _e.cancelable)
			_e.preventDefault();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 휠 라우팅.
	// @param _e: 네이티브 이벤트
	private static OnWheel(_e: WheelEvent): void
	{
		const target = ElementRegistry.FromEventTarget(_e.target);
		if (target === null)
			return;
		const args = new WheelEventArgs(target, _e);
		target.RaiseEvent(target.PreviewWheel, args);
		if (!args.Handled)
			target.RaiseEvent(target.Wheel, args);
		if (args.Handled && _e.cancelable)
			_e.preventDefault();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 포커스 진입/이탈을 Direct로 쏜다.
	// @param _e: 네이티브 이벤트
	private static OnFocus(_e: FocusEvent): void
	{
		const target = ElementRegistry.FromEventTarget(_e.target);
		if (target === null)
			return;
		if (_e.type === "focusin")
			target.RaiseEvent(target.GotFocus, new RoutedEventArgs(target));
		else
			target.RaiseEvent(target.LostFocus, new RoutedEventArgs(target));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 우클릭 메뉴. preventDefault 후 ContextMenuOpening 버블.
	// @param _e: 네이티브 이벤트
	private static OnContextMenu(_e: MouseEvent): void
	{
		const target = ElementRegistry.FromEventTarget(_e.target);
		if (target === null)
			return;
		_e.preventDefault();
		const pointer = new PointerEvent("pointerdown", { clientX: _e.clientX, clientY: _e.clientY, button: 2 });
		target.RaiseEvent(target.ContextMenuOpening, new PointerEventArgs(target, pointer));
	}
}
