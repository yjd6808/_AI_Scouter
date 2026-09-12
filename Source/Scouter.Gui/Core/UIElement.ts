/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 모든 UI 요소의 베이스. DOM 엘리먼트 1개를 소유하고 UIProperty·RoutedEvent·논리 트리를 제공한다.
*/

import { UIProperty } from "./UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy, PointerEventArgs, KeyEventArgs, WheelEventArgs, PropertyChangedEventArgs, SizeChangedEventArgs } from "./RoutedEvent";
import { ElementRegistry } from "./ElementRegistry";
import { SizeObserver } from "./SizeObserver";
import { Thickness } from "./Thickness";
import { Visibility, HAlign, VAlign } from "./UITypes";
import type { IDisposable } from "./Disposable";
import type { ContextMenu } from "../Controls/Items/ContextMenu";

export abstract class UIElement implements IDisposable
{
	// ==================== 정적 ====================
	public static readonly NameProperty = UIProperty.Register<string>("Name", UIElement, { Default: "" });
	public static readonly WidthProperty = UIProperty.Register<number | "Auto">("Width", UIElement, { Default: "Auto", Parse: (_text) => UIProperty.ParseLength(_text) });
	public static readonly HeightProperty = UIProperty.Register<number | "Auto">("Height", UIElement, { Default: "Auto", Parse: (_text) => UIProperty.ParseLength(_text) });
	public static readonly MinWidthProperty = UIProperty.Register<number>("MinWidth", UIElement, { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly MaxWidthProperty = UIProperty.Register<number>("MaxWidth", UIElement, { Default: Number.POSITIVE_INFINITY, Parse: (_text) => Number(_text) });
	public static readonly MinHeightProperty = UIProperty.Register<number>("MinHeight", UIElement, { Default: 0, Parse: (_text) => Number(_text) });
	public static readonly MaxHeightProperty = UIProperty.Register<number>("MaxHeight", UIElement, { Default: Number.POSITIVE_INFINITY, Parse: (_text) => Number(_text) });
	public static readonly MarginProperty = UIProperty.Register<Thickness>("Margin", UIElement, { Default: () => new Thickness(0, 0, 0, 0), Parse: (_text) => Thickness.Parse(_text) });
	public static readonly HorizontalAlignmentProperty = UIProperty.Register<HAlign>("HorizontalAlignment", UIElement, { Default: HAlign.Stretch });
	public static readonly VerticalAlignmentProperty = UIProperty.Register<VAlign>("VerticalAlignment", UIElement, { Default: VAlign.Stretch });
	public static readonly VisibilityProperty = UIProperty.Register<Visibility>("Visibility", UIElement, { Default: Visibility.Visible });
	public static readonly IsEnabledProperty = UIProperty.Register<boolean>("IsEnabled", UIElement, { Default: true, Inherits: true });
	public static readonly OpacityProperty = UIProperty.Register<number>("Opacity", UIElement, { Default: 1, Parse: (_text) => Number(_text) });
	public static readonly ToolTipProperty = UIProperty.Register<string>("ToolTip", UIElement, { Default: "" });
	public static readonly FocusableProperty = UIProperty.Register<boolean>("Focusable", UIElement, { Default: false });
	public static readonly TagProperty = UIProperty.Register<unknown>("Tag", UIElement, { Default: null });

	private static s_nextId_ = 1;

	// ==================== 멤버 ====================
	protected readonly element_: HTMLElement;
	private parent_: UIElement | null = null;
	private readonly children_: UIElement[] = [];
	private readonly values_ = new Map<UIProperty<unknown>, unknown>();
	private readonly attached_ = new Map<unknown, unknown>();
	private isLoaded_ = false;
	private isSizeObserved_ = false;
	private contextMenu_: ContextMenu | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// DOM 노드 1개를 만들고 18개 이벤트를 초기화한다. 추상이므로 직접 new 불가.
	// @param _tag: DOM 태그 (기본 div)
	public constructor(_tag = "div")
	{
		this.element_ = document.createElement(_tag);
		this.element_.dataset["id"] = String(UIElement.s_nextId_++);
		ElementRegistry.Bind(this.element_, this);

		this.PreviewPointerDown = this.CreateEvent<PointerEventArgs>("PreviewPointerDown", RoutingStrategy.Tunnel);
		this.PointerDown = this.CreateEvent<PointerEventArgs>("PointerDown", RoutingStrategy.Bubble);
		this.PreviewPointerUp = this.CreateEvent<PointerEventArgs>("PreviewPointerUp", RoutingStrategy.Tunnel);
		this.PointerUp = this.CreateEvent<PointerEventArgs>("PointerUp", RoutingStrategy.Bubble);
		this.PreviewPointerMove = this.CreateEvent<PointerEventArgs>("PreviewPointerMove", RoutingStrategy.Tunnel);
		this.PointerMove = this.CreateEvent<PointerEventArgs>("PointerMove", RoutingStrategy.Bubble);
		this.PointerEnter = this.CreateEvent<PointerEventArgs>("PointerEnter", RoutingStrategy.Direct);
		this.PointerLeave = this.CreateEvent<PointerEventArgs>("PointerLeave", RoutingStrategy.Direct);
		this.PreviewKeyDown = this.CreateEvent<KeyEventArgs>("PreviewKeyDown", RoutingStrategy.Tunnel);
		this.KeyDown = this.CreateEvent<KeyEventArgs>("KeyDown", RoutingStrategy.Bubble);
		this.PreviewKeyUp = this.CreateEvent<KeyEventArgs>("PreviewKeyUp", RoutingStrategy.Tunnel);
		this.KeyUp = this.CreateEvent<KeyEventArgs>("KeyUp", RoutingStrategy.Bubble);
		this.PreviewWheel = this.CreateEvent<WheelEventArgs>("PreviewWheel", RoutingStrategy.Tunnel);
		this.Wheel = this.CreateEvent<WheelEventArgs>("Wheel", RoutingStrategy.Bubble);
		this.GotFocus = this.CreateEvent<RoutedEventArgs>("GotFocus", RoutingStrategy.Direct);
		this.LostFocus = this.CreateEvent<RoutedEventArgs>("LostFocus", RoutingStrategy.Direct);
		this.Loaded = this.CreateEvent<RoutedEventArgs>("Loaded", RoutingStrategy.Direct);
		this.Unloaded = this.CreateEvent<RoutedEventArgs>("Unloaded", RoutingStrategy.Direct);
		this.SizeChanged = this.CreateEvent<SizeChangedEventArgs>("SizeChanged", RoutingStrategy.Direct);
		this.PropertyChanged = this.CreateEvent<PropertyChangedEventArgs>("PropertyChanged", RoutingStrategy.Direct);
		this.ContextMenuOpening = this.CreateEvent<PointerEventArgs>("ContextMenuOpening", RoutingStrategy.Bubble);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// DOM에서 제거하고 자식까지 정리한다. 두 번 호출해도 안전.
	public Dispose(): void
	{
		if (this.isLoaded_)
			this.NotifyUnloaded();
		if (this.parent_ !== null)
			this.parent_.RemoveChild(this, false);
		for (const child of [...this.children_])
			child.Dispose();
		if (this.isSizeObserved_)
		{
			SizeObserver.Unobserve(this);
			this.isSizeObserved_ = false;
		}
		ElementRegistry.Unbind(this.element_);
		this.OnDispose();
		this.element_.remove();
	}

	// ==================== 속성 ====================
	public get Element(): HTMLElement { return this.element_; }
	public get Parent(): UIElement | null { return this.parent_; }
	public get Children(): ReadonlyArray<UIElement> { return this.children_; }
	public get IsLoaded(): boolean { return this.isLoaded_; }
	//////////////////////////////////////////////////////////////////////////////////////
	// 접힘 상태면 보이지 않는다. 부모가 접혀도 마찬가지.
	public get IsVisible(): boolean
	{
		if (this.GetValue(UIElement.VisibilityProperty) === Visibility.Collapsed)
			return false;
		return this.parent_?.IsVisible ?? true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 최상위 요소를 구한다. 부모가 없으면 자기.
	public get Root(): UIElement | null
	{
		let node = this.Parent;
		if (node === null)
			return this;
		while (node.Parent !== null)
			node = node.Parent;
		return node;
	}

	public get Name(): string { return this.GetValue(UIElement.NameProperty); }
	public set Name(_v: string) { this.SetValue(UIElement.NameProperty, _v); }
	public get Width(): number | "Auto" { return this.GetValue(UIElement.WidthProperty); }
	public set Width(_v: number | "Auto") { this.SetValue(UIElement.WidthProperty, _v); }
	public get Height(): number | "Auto" { return this.GetValue(UIElement.HeightProperty); }
	public set Height(_v: number | "Auto") { this.SetValue(UIElement.HeightProperty, _v); }
	public get Visibility(): Visibility { return this.GetValue(UIElement.VisibilityProperty); }
	public set Visibility(_v: Visibility) { this.SetValue(UIElement.VisibilityProperty, _v); }
	public get IsEnabled(): boolean { return this.GetValue(UIElement.IsEnabledProperty); }
	public set IsEnabled(_v: boolean) { this.SetValue(UIElement.IsEnabledProperty, _v); }
	public get Opacity(): number { return this.GetValue(UIElement.OpacityProperty); }
	public set Opacity(_v: number) { this.SetValue(UIElement.OpacityProperty, _v); }
	public get ToolTip(): string { return this.GetValue(UIElement.ToolTipProperty); }
	public set ToolTip(_v: string) { this.SetValue(UIElement.ToolTipProperty, _v); }
	public get Focusable(): boolean { return this.GetValue(UIElement.FocusableProperty); }
	public set Focusable(_v: boolean) { this.SetValue(UIElement.FocusableProperty, _v); }
	public get Tag(): unknown { return this.GetValue(UIElement.TagProperty); }
	public set Tag(_v: unknown) { this.SetValue(UIElement.TagProperty, _v); }
	public get ContextMenu(): ContextMenu | null { return this.contextMenu_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 우클릭 메뉴를 단다. 첫 설정 때 열기 구독을 건다.
	// @param _v: 메뉴 (null이면 해제)
	public set ContextMenu(_v: ContextMenu | null)
	{
		const first = this.contextMenu_ === null && _v !== null;
		this.contextMenu_ = _v;
		if (first)
		{
			this.ContextMenuOpening.Add((_s, _a) =>
			{
				this.contextMenu_?.OpenAt(_a.X, _a.Y);
			});
		}
	}

	// ==================== 이벤트 ====================
	public readonly PreviewPointerDown: RoutedEvent<PointerEventArgs>;
	public readonly PointerDown: RoutedEvent<PointerEventArgs>;
	public readonly PreviewPointerUp: RoutedEvent<PointerEventArgs>;
	public readonly PointerUp: RoutedEvent<PointerEventArgs>;
	public readonly PreviewPointerMove: RoutedEvent<PointerEventArgs>;
	public readonly PointerMove: RoutedEvent<PointerEventArgs>;
	public readonly PointerEnter: RoutedEvent<PointerEventArgs>;
	public readonly PointerLeave: RoutedEvent<PointerEventArgs>;
	public readonly PreviewKeyDown: RoutedEvent<KeyEventArgs>;
	public readonly KeyDown: RoutedEvent<KeyEventArgs>;
	public readonly PreviewKeyUp: RoutedEvent<KeyEventArgs>;
	public readonly KeyUp: RoutedEvent<KeyEventArgs>;
	public readonly PreviewWheel: RoutedEvent<WheelEventArgs>;
	public readonly Wheel: RoutedEvent<WheelEventArgs>;
	public readonly GotFocus: RoutedEvent<RoutedEventArgs>;
	public readonly LostFocus: RoutedEvent<RoutedEventArgs>;
	public readonly Loaded: RoutedEvent<RoutedEventArgs>;
	public readonly Unloaded: RoutedEvent<RoutedEventArgs>;
	public readonly SizeChanged: RoutedEvent<SizeChangedEventArgs>;
	public readonly PropertyChanged: RoutedEvent<PropertyChangedEventArgs>;
	public readonly ContextMenuOpening: RoutedEvent<PointerEventArgs>;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다. 미설정이면 기본값.
	// @param _prop: 속성
	public GetValue<T>(_prop: UIProperty<T>): T
	{
		if (this.values_.has(_prop))
			return this.values_.get(_prop) as T;
		return _prop.GetDefault();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓴다. Coerce → 비교 → DOM 반영 → 확장점 → PropertyChanged → 상속 전파.
	// @param _prop: 속성
	// @param _value: 값
	public SetValue<T>(_prop: UIProperty<T>, _value: T): void
	{
		const coerced = _prop.Meta.Coerce !== undefined ? _prop.Meta.Coerce(this, _value) : _value;
		const old = this.GetValue(_prop);
		if (Object.is(old, coerced))
			return;
		this.values_.set(_prop, coerced);
		this.ApplyProperty(_prop, coerced);
		this.OnPropertyChanged(_prop, old, coerced);
		if (this.PropertyChanged.HasHandlers)
			this.PropertyChanged.Invoke(this, new PropertyChangedEventArgs(this, _prop, old, coerced));
		if (_prop.Meta.Inherits === true)
			this.PropagateInherited(_prop);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로컬 값을 지우고 기본값으로 되돌린다.
	// @param _prop: 속성
	public ClearValue(_prop: UIProperty<unknown>): void
	{
		if (!this.values_.has(_prop))
			return;
		this.values_.delete(_prop);
		this.ApplyProperty(_prop, this.GetInheritedOrDefault(_prop));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식을 끝에(또는 인덱스에) 붙인다.
	// @param _child: 자식
	// @param _index: 위치 (생략 시 끝)
	public AddChild(_child: UIElement, _index?: number): void
	{
		if (_child.parent_ !== null)
			_child.parent_.RemoveChild(_child, false);
		_child.parent_ = this;
		if (_index === undefined || _index >= this.children_.length)
		{
			this.children_.push(_child);
			this.element_.append(_child.element_);
		}
		else
		{
			this.children_.splice(_index, 0, _child);
			this.element_.insertBefore(_child.element_, this.element_.children[_index] as Element | null);
		}
		_child.ApplyInheritedFrom(this);
		this.OnChildAdded(_child);
		if (this.isLoaded_)
			_child.NotifyLoaded();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식을 뗀다. dispose면 Dispose까지.
	// @param _child: 자식
	// @param _dispose: 폐기 여부 (기본 true)
	public RemoveChild(_child: UIElement, _dispose = true): void
	{
		const idx = this.children_.indexOf(_child);
		if (idx < 0)
			return;
		this.children_.splice(idx, 1);
		_child.parent_ = null;
		_child.element_.remove();
		this.OnChildRemoved(_child);
		if (_dispose)
			_child.Dispose();
		else if (_child.isLoaded_)
			_child.NotifyUnloaded();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 자식을 뗀다.
	public ClearChildren(): void
	{
		for (const child of [...this.children_])
			this.RemoveChild(child, true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름으로 자손 요소를 검색한다. 타입이 다르면 null.
	// @param _type: 기대 클래스
	// @param _name: XML Name (= data-testid)
	public FindName<T extends UIElement>(_type: abstract new (...args: never[]) => T, _name: string): T | null
	{
		const found = this.FindByName(_name);
		return found instanceof _type ? found : null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 없으면 throw하는 FindName. 개발 중 오타를 즉시 잡는다.
	// @param _type: 기대 클래스
	// @param _name: XML Name
	public RequireName<T extends UIElement>(_type: abstract new (...args: never[]) => T, _name: string): T
	{
		const found = this.FindName(_type, _name);
		if (found === null)
			throw new Error(`[${this.constructor.name}] RequireName 실패: ${_name}`);
		return found;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 조상 중 첫 T를 찾는다.
	// @param _type: 기대 클래스
	public FindAncestor<T extends UIElement>(_type: abstract new (...args: never[]) => T): T | null
	{
		let node = this.parent_;
		while (node !== null)
		{
			if (node instanceof _type)
				return node;
			node = node.parent_;
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// _other의 조상인지 본다.
	// @param _other: 후보 자손
	public IsAncestorOf(_other: UIElement): boolean
	{
		let node = _other.parent_;
		while (node !== null)
		{
			if (node === this)
				return true;
			node = node.parent_;
		}
		return false;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 라우티드 이벤트를 쏜다. Tunnel은 root→self, Bubble은 self→root.
	// @param _event: 이벤트
	// @param _args: 인자
	public RaiseEvent<TArgs extends RoutedEventArgs>(_event: RoutedEvent<TArgs>, _args: TArgs): void
	{
		if (_event.Strategy === RoutingStrategy.Direct)
		{
			_event.Invoke(this, _args);
			return;
		}
		const path: UIElement[] = [this];
		for (let node = this.Parent; node !== null; node = node.Parent)
			path.push(node);
		if (_event.Strategy === RoutingStrategy.Tunnel)
			path.reverse();
		for (const node of path)
		{
			const target = node.GetEventInstance(_event);
			if (target === null || !target.HasHandlers)
				continue;
			target.Invoke(node, _args);
			if (_args.Handled)
				break;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 포커스를 준다. Focusable이 아니면 false.
	public Focus(): boolean
	{
		if (!this.Focusable || !this.IsEnabled)
			return false;
		this.element_.focus({ preventScroll: true });
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 붙임 속성 값을 읽는다.
	// @param _prop: 붙임 속성 키
	public GetAttached(_prop: object): unknown
	{
		return this.attached_.get(_prop);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 붙임 속성 값을 쓰고 부모 Panel에 알린다.
	// @param _prop: 붙임 속성 키
	// @param _value: 값
	public SetAttached(_prop: object, _value: unknown): void
	{
		this.attached_.set(_prop, _value);
		this.parent_?.OnAttachedChanged(this, _prop);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Loaded를 전파한다. UIManager·AddChild가 호출.
	public NotifyLoaded(): void
	{
		if (this.isLoaded_)
			return;
		this.isLoaded_ = true;
		this.OnLoaded();
		if (this.Loaded.HasHandlers)
			this.Loaded.Invoke(this, new RoutedEventArgs(this));
		if (this.SizeChanged.HasHandlers && !this.isSizeObserved_)
		{
			SizeObserver.Observe(this);
			this.isSizeObserved_ = true;
		}
		for (const child of this.children_)
			child.NotifyLoaded();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Unloaded를 전파한다. 자식 먼저, 자기 나중.
	public NotifyUnloaded(): void
	{
		if (!this.isLoaded_)
			return;
		for (const child of this.children_)
			child.NotifyUnloaded();
		this.isLoaded_ = false;
		this.OnUnloaded();
		if (this.Unloaded.HasHandlers)
			this.Unloaded.Invoke(this, new RoutedEventArgs(this));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// SizeObserver 콜백 진입점. OnSizeChanged → SizeChanged.
	// @param _w: 너비
	// @param _h: 높이
	public NotifySizeChanged(_w: number, _h: number): void
	{
		this.OnSizeChanged(_w, _h);
		if (this.SizeChanged.HasHandlers)
			this.SizeChanged.Invoke(this, new SizeChangedEventArgs(this, { Width: _w, Height: _h }));
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 하위 클래스가 자원을 해제한다. 기본 구현 없음.
	protected OnDispose(): void
	{
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 속성 변경 후처리. 바인딩 polish·파생 갱신 지점.
	// @param _prop: 속성
	// @param _old: 이전 값
	// @param _next: 새 값
	protected OnPropertyChanged(_prop: UIProperty<unknown>, _old: unknown, _next: unknown): void
	{
		// 의도적 빈 구현. 하위 클래스 확장점.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식 추가 후처리. Panel이 레이아웃을 건다.
	// @param _child: 자식
	protected OnChildAdded(_child: UIElement): void
	{
		// 의도적 빈 구현. Panel이 오버라이드.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식 제거 후처리.
	// @param _child: 자식
	protected OnChildRemoved(_child: UIElement): void
	{
		// 의도적 빈 구현. Panel이 오버라이드.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 붙임 속성 변경 통지. Panel이 ApplyChildLayout을 다시 건다.
	// @param _child: 자식
	// @param _prop: 붙임 속성 키
	protected OnAttachedChanged(_child: UIElement, _prop: unknown): void
	{
		// 의도적 빈 구현. Panel이 오버라이드.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Loaded 진입점. 크기를 잴 수 있는 첫 시점.
	protected OnLoaded(): void
	{
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Unloaded 진입점.
	protected OnUnloaded(): void
	{
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 크기 변경 진입점.
	// @param _w: 너비
	// @param _h: 높이
	protected OnSizeChanged(_w: number, _h: number): void
	{
		// 의도적 빈 구현. 하위 클래스 확장점.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다. 하위 클래스는 super 호출 후 자기 분기.
	// @param _prop: 속성
	// @param _value: 값
	protected ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		switch (_prop)
		{
			case UIElement.NameProperty:
				if ((_value as string).length > 0)
					this.element_.dataset["testid"] = _value as string;
				else
					delete this.element_.dataset["testid"];
				break;
			case UIElement.WidthProperty:
				this.element_.style.width = _value === "Auto" ? "" : `${_value as number}px`;
				break;
			case UIElement.HeightProperty:
				this.element_.style.height = _value === "Auto" ? "" : `${_value as number}px`;
				break;
			case UIElement.MinWidthProperty:
				this.element_.style.minWidth = `${_value as number}px`;
				break;
			case UIElement.MaxWidthProperty:
				this.element_.style.maxWidth = Number.isFinite(_value) ? `${_value as number}px` : "";
				break;
			case UIElement.MinHeightProperty:
				this.element_.style.minHeight = `${_value as number}px`;
				break;
			case UIElement.MaxHeightProperty:
				this.element_.style.maxHeight = Number.isFinite(_value) ? `${_value as number}px` : "";
				break;
			case UIElement.MarginProperty:
				this.element_.style.margin = (_value as Thickness).ToCss();
				break;
			case UIElement.HorizontalAlignmentProperty:
				this.element_.dataset["halign"] = _value as string;
				break;
			case UIElement.VerticalAlignmentProperty:
				this.element_.dataset["valign"] = _value as string;
				break;
			case UIElement.VisibilityProperty:
				this.element_.classList.toggle("is-collapsed", _value === Visibility.Collapsed);
				this.element_.classList.toggle("is-hidden", _value === Visibility.Hidden);
				if (_value === Visibility.Collapsed)
					this.element_.style.display = "none";
				else
				{
					this.element_.style.display = "";
					this.element_.style.visibility = _value === Visibility.Hidden ? "hidden" : "";
				}
				break;
			case UIElement.IsEnabledProperty:
				if (_value === false)
					this.element_.setAttribute("inert", "");
				else
					this.element_.removeAttribute("inert");
				this.element_.classList.toggle("is-disabled", _value === false);
				this.element_.setAttribute("aria-disabled", _value === false ? "true" : "false");
				break;
			case UIElement.OpacityProperty:
				this.element_.style.opacity = String(_value);
				break;
			case UIElement.ToolTipProperty:
				if ((_value as string).length > 0)
					this.element_.dataset["tooltip"] = _value as string;
				else
					delete this.element_.dataset["tooltip"];
				break;
			case UIElement.FocusableProperty:
				this.element_.tabIndex = _value === true ? 0 : -1;
				break;
			default:
				break;
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 같은 이름의 이벤트 필드를 찾는다. 이름 일치가 계약.
	// @param _event: 이벤트
	private GetEventInstance<TArgs extends RoutedEventArgs>(_event: RoutedEvent<TArgs>): RoutedEvent<TArgs> | null
	{
		const found = (this as unknown as Record<string, unknown>)[_event.Name];
		return found instanceof RoutedEvent ? (found as RoutedEvent<TArgs>) : null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이벤트 인스턴스를 만든다. 이름이 곧 키다.
	// @param _name: 이름
	// @param _strategy: 전략
	private CreateEvent<TArgs extends RoutedEventArgs>(_name: string, _strategy: RoutingStrategy): RoutedEvent<TArgs>
	{
		return new RoutedEvent<TArgs>(_name, _strategy);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 깊이 우선 탐색. 최초 일치 1개.
	// @param _name: 이름
	private FindByName(_name: string): UIElement | null
	{
		for (const child of this.children_)
		{
			if (child.Name === _name)
				return child;
			const deep = child.FindByName(_name);
			if (deep !== null)
				return deep;
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상속 속성을 자식에게 전파한다. 로컬 값이 없을 때만.
	// @param _prop: 속성
	private PropagateInherited(_prop: UIProperty<unknown>): void
	{
		for (const child of this.children_)
		{
			if (!child.values_.has(_prop))
				child.ApplyProperty(_prop, this.GetValue(_prop));
			child.PropagateInherited(_prop);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 부모의 상속 값을 받아온다. AddChild 시점.
	// @param _parent: 부모
	private ApplyInheritedFrom(_parent: UIElement): void
	{
		for (const prop of [UIElement.IsEnabledProperty])
		{
			if (!this.values_.has(prop) && prop.Meta.Inherits === true)
				this.ApplyProperty(prop, _parent.GetValue(prop));
		}
		for (const child of this.children_)
			child.ApplyInheritedFrom(this);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상속 체인에서 유효값을 구한다. ClearValue용.
	// @param _prop: 속성
	private GetInheritedOrDefault(_prop: UIProperty<unknown>): unknown
	{
		if (_prop.Meta.Inherits === true && this.parent_ !== null)
			return this.parent_.GetValue(_prop);
		return _prop.GetDefault();
	}
}
