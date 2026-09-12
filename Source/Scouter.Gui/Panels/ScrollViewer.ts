/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ScrollViewer. 스크롤 + 끝 자동 따라가기.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../Core/RoutedEvent";
import { Decorator } from "./Decorator";

export enum ScrollBarVisibility
{
	Auto = "Auto",
	Hidden = "Hidden",
	Visible = "Visible",
	Disabled = "Disabled",
}

export class ScrollViewer extends Decorator
{
	// ==================== 정적 ====================
	public static readonly HorizontalScrollBarVisibilityProperty = UIProperty.Register<ScrollBarVisibility>("HorizontalScrollBarVisibility", ScrollViewer, { Default: ScrollBarVisibility.Auto });
	public static readonly VerticalScrollBarVisibilityProperty = UIProperty.Register<ScrollBarVisibility>("VerticalScrollBarVisibility", ScrollViewer, { Default: ScrollBarVisibility.Auto });
	public static readonly IsAutoScrollToEndProperty = UIProperty.Register<boolean>("IsAutoScrollToEnd", ScrollViewer, { Default: false });

	// ==================== 멤버 ====================
	private wasAtEnd_ = true;
	private onScroll_: ((_e: Event) => void) | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// scroll div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-scroll");
		this.onScroll_ = () => { this.RefreshAtEnd(); };
		this.Element.addEventListener("scroll", this.onScroll_, { passive: true });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 리스너를 떼고 정리한다.
	protected override OnDispose(): void
	{
		if (this.onScroll_ !== null)
			this.Element.removeEventListener("scroll", this.onScroll_);
	}

	// ==================== 속성 ====================
	public get IsAutoScrollToEnd(): boolean { return this.GetValue(ScrollViewer.IsAutoScrollToEndProperty); }
	public set IsAutoScrollToEnd(_v: boolean) { this.SetValue(ScrollViewer.IsAutoScrollToEndProperty, _v); }

	//////////////////////////////////////////////////////////////////////////////////////
	// 끝에 닿았는지 본다. 반올림 오차 8px 허용.
	public get IsAtEnd(): boolean
	{
		const el = this.Element;
		return el.scrollHeight - el.scrollTop - el.clientHeight < 8;
	}

	// ==================== 이벤트 ====================
	public readonly ScrollChanged = this.CreateScrollChanged();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 맨 끝으로 보낸다.
	public ScrollToEnd(): void
	{
		this.Element.scrollTop = this.Element.scrollHeight;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 지정 위치로 보낸다.
	// @param _x: 가로
	// @param _y: 세로
	public ScrollTo(_x: number, _y: number): void
	{
		this.Element.scrollLeft = _x;
		this.Element.scrollTop = _y;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 요소가 보이게 보낸다.
	// @param _element: 요소
	public ScrollIntoView(_element: UIElement): void
	{
		_element.Element.scrollIntoView({ block: "nearest" });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식이 늘면 끝이었을 때만 따라간다. LogView가 호출.
	public FollowAppended(): void
	{
		if (this.IsAutoScrollToEnd && this.wasAtEnd_)
			this.ScrollToEnd();
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자식이 붙으면 끝 따라가기를 시도한다.
	// @param _child: 자식
	protected override OnChildAdded(_child: UIElement): void
	{
		this.FollowAppended();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// ScrollChanged 이벤트를 만든다. 필드 초기화 순서용.
	private CreateScrollChanged(): RoutedEvent<RoutedEventArgs>
	{
		return new RoutedEvent<RoutedEventArgs>("ScrollChanged", RoutingStrategy.Bubble);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스크롤 위치를 갱신하고 이벤트를 쏜다.
	private RefreshAtEnd(): void
	{
		this.wasAtEnd_ = this.IsAtEnd;
		this.RaiseEvent(this.ScrollChanged, new RoutedEventArgs(this));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 가시성을 overflow로 번역한다.
	// @param _v: 가시성
	private static ToOverflow(_v: ScrollBarVisibility): string
	{
		switch (_v)
		{
			case ScrollBarVisibility.Auto: return "auto";
			case ScrollBarVisibility.Hidden: return "hidden";
			case ScrollBarVisibility.Visible: return "scroll";
			case ScrollBarVisibility.Disabled: return "clip";
			default: return "auto";
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 속성 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === ScrollViewer.HorizontalScrollBarVisibilityProperty)
			this.Element.style.overflowX = ScrollViewer.ToOverflow(_value as ScrollBarVisibility);
		else if (_prop === ScrollViewer.VerticalScrollBarVisibilityProperty)
			this.Element.style.overflowY = ScrollViewer.ToOverflow(_value as ScrollBarVisibility);
	}
}
