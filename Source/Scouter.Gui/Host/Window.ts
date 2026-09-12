/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Window. UIManager가 레이어에 올리는 화면 단위다. ContentControl을 확장한다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy, KeyEventArgs } from "../Core/RoutedEvent";
import { ContentControl } from "../Controls/ContentControl";
import { UILayerKind } from "./UILayer";
import { DataList } from "../Xml/DataList";

export class ClosingEventArgs extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public Cancel = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 발신 요소로 만든다.
	// @param _source: 발신 요소
	public constructor(_source: UIElement)
	{
		super(_source);
	}
}

export class Window extends ContentControl
{
	// ==================== 정적 ====================
	public static readonly TitleProperty = UIProperty.Register<string>("Title", Window, { Default: "" });

	// ==================== 멤버 ====================
	public readonly DataList = new DataList();
	private layer_ = UILayerKind.Base;
	private result_: unknown = undefined;
	private owner_: Window | null = null;
	private isModal_ = false;
	private isActive_ = false;
	private closed_ = false;
	private closer_: ((_result: unknown) => void) | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 창 div를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-window");
		this.Shown = new RoutedEvent<RoutedEventArgs>("Shown", RoutingStrategy.Direct);
		this.Closing = new RoutedEvent<ClosingEventArgs>("Closing", RoutingStrategy.Direct);
		this.Closed = new RoutedEvent<RoutedEventArgs>("Closed", RoutingStrategy.Direct);
	}

	// ==================== 속성 ====================
	public get Title(): string { return this.GetValue(Window.TitleProperty); }
	public set Title(_v: string) { this.SetValue(Window.TitleProperty, _v); }
	public get Layer(): UILayerKind { return this.layer_; }
	public set Layer(_v: UILayerKind) { this.layer_ = _v; }
	public get Result(): unknown { return this.result_; }
	public get Owner(): Window | null { return this.owner_; }
	public set Owner(_v: Window | null) { this.owner_ = _v; }
	public get IsModal(): boolean { return this.isModal_; }
	public set IsModal(_v: boolean) { this.isModal_ = _v; }
	public get IsActive(): boolean { return this.isActive_; }
	public get IsClosed(): boolean { return this.closed_; }

	// ==================== 이벤트 ====================
	public readonly Shown: RoutedEvent<RoutedEventArgs>;
	public readonly Closing: RoutedEvent<ClosingEventArgs>;
	public readonly Closed: RoutedEvent<RoutedEventArgs>;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫기를 요청한다. UIManager가 실제 제거를 맡는다.
	// @param _result: 결과 값
	public Close(_result?: unknown): void
	{
		this.result_ = _result;
		this.OnCloseRequested();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫기 배선을 건다. UIManager.Create 전용. 직접 호출 금지.
	// @param _fn: 닫기 처리
	public SetCloser(_fn: (_result: unknown) => void): void
	{
		this.closer_ = _fn;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 미리보기. ESC면 닫기, Enter면 IsDefault 버튼. 하위 확장.
	// @param _args: 인자
	public PreviewKey(_args: KeyEventArgs): void
	{
		this.OnKeyDownPreview(_args);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// UIManager가 호출하는 OnInit 진입점.
	// @param _data: 바인딩 소스
	public InitForManager(_data: DataList): void
	{
		this.OnInit(_data);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// UIManager 전용. 표시 완료 처리.
	public NotifyShown(): void
	{
		this.isActive_ = true;
		this.OnShown();
		if (this.Shown.HasHandlers)
			this.Shown.Invoke(this, new RoutedEventArgs(this));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// UIManager 전용. 닫기 시도. 취소되면 false.
	public NotifyClosing(): boolean
	{
		const args = new ClosingEventArgs(this);
		this.OnClosing(args);
		if (this.Closing.HasHandlers)
			this.Closing.Invoke(this, args);
		return !args.Cancel;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// UIManager 전용. 제거 완료 처리.
	public NotifyClosed(): void
	{
		this.closed_ = true;
		this.isActive_ = false;
		this.OnClosed();
		if (this.Closed.HasHandlers)
			this.Closed.Invoke(this, new RoutedEventArgs(this));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// UIManager 전용. 활성 토글.
	// @param _active: 활성 여부
	public NotifyActivated(_active: boolean): void
	{
		this.isActive_ = _active;
		if (_active)
			this.OnActivated();
		else
			this.OnDeactivated();
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 로더 완료 직후. FindName·핸들러 연결 지점.
	// @param _data: 바인딩 소스
	protected OnInit(_data: DataList): void
	{
		// 의도적 빈 구현. 하위 클래스 확장점.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 레이어 부착 후. 포커스 지점.
	protected OnShown(): void
	{
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫기 전. Cancel=true로 유지 가능.
	// @param _args: 인자
	protected OnClosing(_args: ClosingEventArgs): void
	{
		// 의도적 빈 구현. 하위 클래스 확장점.
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 제거 후. Dispose 직전.
	protected OnClosed(): void
	{
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 미리보기. 기본 ESC 닫기.
	// @param _args: 인자
	protected OnKeyDownPreview(_args: KeyEventArgs): void
	{
		if (_args.Key === "Escape")
			this.Close(undefined);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 활성/비활성.
	protected OnActivated(): void
	{
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 활성/비활성.
	protected OnDeactivated(): void
	{
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Close() 요청 진입점. UIManager에 위임하도록 오버라이드 금지, 그대로 둔다.
	protected OnCloseRequested(): void
	{
		this.closer_?.(this.result_);
	}
}
