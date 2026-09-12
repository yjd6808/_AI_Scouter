/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UIManager 싱글턴. 창 생성·레이어·모달·토스트를 맡는다. XML 트리 구축은 P2 로더가 붙는다.
*/

import { UIElement } from "../Core/UIElement";
import { InputDispatcher } from "../Core/InputDispatcher";
import { Window } from "./Window";
import { UserControl } from "./UserControl";
import { UILayer, UILayerKind } from "./UILayer";
import { WindowRegistry } from "./WindowRegistry";
import type { WindowCtor } from "./WindowRegistry";
import type { ILayoutProvider } from "./ILayoutProvider";
import { XmlLoader } from "../Xml/XmlLoader";
import { LoadContext } from "../Xml/LoadContext";
import { BindingGraph } from "../Xml/BindingGraph";
import type { DataList } from "../Xml/DataList";

export enum ToastKind
{
	Info = "Info",
	Success = "Success",
	Warn = "Warn",
	Error = "Error",
}

export interface IToastOptions
{
	Title: string;
	Message?: string;
	Variant?: ToastKind;
	DurationMs?: number;
}

interface IDialogEntry
{
	Window: Window;
	Resolve: (_result: unknown) => void;
	PrevFocus: Element | null;
	Timer: ReturnType<typeof setTimeout> | null;
}

export class UIManager
{
	// ==================== 정적 ====================
	private static s_root_: UIElement | null = null;
	private static s_provider_: ILayoutProvider | null = null;
	private static readonly s_layers_ = new Map<UILayerKind, UILayer>();
	private static readonly s_windows_ = new Map<string, Window>();
	private static readonly s_xml_ = new Map<string, string>();
	private static readonly s_graphs_ = new Map<Window, BindingGraph>();
	private static s_contextFactory_: (() => LoadContext) | null = null;
	private static readonly s_dialogs_ = new Map<Window, IDialogEntry>();
	private static s_shownHandlers_: Array<(_w: Window) => void> = [];
	private static s_closedHandlers_: Array<(_w: Window) => void> = [];
	private static s_inited_ = false;

	// ==================== 속성 ====================
	public static get Root(): UIElement | null { return UIManager.s_root_; }
	public static get LayoutProvider(): ILayoutProvider | null { return UIManager.s_provider_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 최상위 모달·메인을 구한다.
	public static get Active(): Window | null
	{
		return UIManager.s_layers_.get(UILayerKind.Dialog)?.Top
			?? UIManager.s_layers_.get(UILayerKind.Base)?.Top
			?? null;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 루트·레이어·디스패처를 초기화한다.
	// @param _rootDom: #root DOM
	// @param _provider: 레이아웃 제공자
	// @param _root: 루트 요소 (생략 시 내부 생성)
	public static Init(_rootDom: HTMLElement, _provider: ILayoutProvider, _root?: UIElement): void
	{
		if (UIManager.s_inited_)
			UIManager.Reset();
		const root = _root ?? new UIManagerRoot();
		UIManager.s_root_ = root;
		UIManager.s_provider_ = _provider;
		for (const kind of [UILayerKind.Base, UILayerKind.Dialog, UILayerKind.Popup, UILayerKind.Toast, UILayerKind.Overlay])
		{
			const layer = new UILayer(kind);
			UIManager.s_layers_.set(kind, layer);
			_rootDom.append(layer.Element);
		}
		InputDispatcher.Attach(_rootDom, root);
		UIManager.s_inited_ = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창을 만들어 Base 레이어에 올린다. 코드 전용 경로(XML 없음).
	// @param _name: 창 이름
	// @param _data: 초기 데이터
	public static Show(_name: string, _data?: DataList): Window
	{
		const win = UIManager.Create(_name);
		win.InitForManager(_data ?? win.DataList);
		UIManager.Place(win, UILayerKind.Base);
		win.NotifyShown();
		UIManager.EmitShown(win);
		return win;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// XML을 읽어 창을 올린다. P2 추가 경로.
	// @param _name: 창 이름
	// @param _data: 데이터 오버라이드
	public static async ShowAsync(_name: string, _data?: Record<string, unknown>): Promise<Window>
	{
		const win = UIManager.Create(_name);
		await UIManager.LoadInto(win, _name, _data);
		win.InitForManager(win.DataList);
		UIManager.Place(win, UILayerKind.Base);
		win.NotifyShown();
		UIManager.EmitShown(win);
		return win;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 모달로 올리고 결과를 기다린다. 타임아웃 0이면 무한 대기.
	// @param _name: 창 이름
	// @param _data: 초기 데이터
	// @param _timeoutMs: 타임아웃 (기본 0)
	public static ShowDialog<T>(_name: string, _data?: DataList, _timeoutMs = 0): Promise<T>
	{
		const win = UIManager.Create(_name);
		win.InitForManager(_data ?? win.DataList);
		return UIManager.ShowDialogLoaded<T>(win, _timeoutMs);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// XML을 읽어 모달로 올린다. 다이얼로그 XML용.
	// @param _name: 창 이름
	// @param _data: 데이터 오버라이드
	// @param _timeoutMs: 타임아웃 (기본 0)
	public static async ShowDialogAsync<T>(_name: string, _data?: Record<string, unknown>, _timeoutMs = 0): Promise<T>
	{
		const win = UIManager.Create(_name);
		await UIManager.LoadInto(win, _name, _data);
		win.InitForManager(win.DataList);
		return UIManager.ShowDialogLoaded<T>(win, _timeoutMs);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로드된 창을 모달로 올린다. ShowDialog 공용 뒷단.
	// @param _win: 창
	// @param _timeoutMs: 타임아웃
	private static ShowDialogLoaded<T>(_win: Window, _timeoutMs: number): Promise<T>
	{
		const win = _win;
		win.IsModal = true;
		const prevFocus = document.activeElement;
		UIManager.SetBaseInert(true);
		UIManager.Place(win, UILayerKind.Dialog);
		win.NotifyShown();
		UIManager.EmitShown(win);
		UIManager.FocusFirst(win);
		return new Promise<T>((_resolve) =>
		{
			const entry: IDialogEntry = {
				Window: win,
				Resolve: (_result: unknown) =>
				{
					if (entry.Timer !== null)
						clearTimeout(entry.Timer);
					UIManager.s_dialogs_.delete(win);
					_resolve(_result as T);
				},
				PrevFocus: prevFocus,
				Timer: null,
			};
			if (_timeoutMs > 0)
			{
				entry.Timer = setTimeout(() =>
				{
					UIManager.Close(win, undefined);
				}, _timeoutMs);
			}
			UIManager.s_dialogs_.set(win, entry);
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창을 닫는다. Closing 취소면 유지. 다이얼로그면 Promise를 푼다.
	// @param _window: 창
	// @param _result: 결과 값
	public static Close(_window: Window, _result?: unknown): boolean
	{
		if (!_window.NotifyClosing())
			return false;
		const entry = UIManager.s_dialogs_.get(_window);
		UIManager.RemoveFromLayers(_window);
		_window.NotifyClosed();
		UIManager.EmitClosed(_window);
		if (entry !== undefined)
		{
			if (UIManager.s_dialogs_.size === 0)
			{
				UIManager.SetBaseInert(false);
				if (entry.PrevFocus instanceof HTMLElement)
					entry.PrevFocus.focus({ preventScroll: true });
			}
			entry.Resolve(_result);
		}
		_window.Dispose();
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 레이어(생략 시 전부)를 닫는다.
	// @param _layer: 레이어
	public static CloseAll(_layer?: UILayerKind): void
	{
		for (const [kind, layer] of UIManager.s_layers_)
		{
			if (_layer !== undefined && kind !== _layer)
				continue;
			for (const win of layer.Clear())
			{
				win.NotifyClosed();
				UIManager.EmitClosed(win);
				win.Dispose();
			}
		}
		if (_layer === undefined || _layer === UILayerKind.Dialog)
			UIManager.SetBaseInert(false);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 레이어 DOM을 구한다. Popup 배치용.
	// @param _layer: 레이어
	public static LayerElement(_layer: UILayerKind): HTMLElement | null
	{
		return UIManager.s_layers_.get(_layer)?.Element ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름으로 열린 창을 찾는다.
	// @param _name: 창 이름
	public static Find(_name: string): Window | null
	{
		return UIManager.s_windows_.get(_name) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// UserControl을 만든다. Plugin 메인 뷰용.
	// @param _name: 등록 이름
	// @param _data: 초기 데이터
	public static CreateUserControl(_name: string, _data?: DataList): UserControl
	{
		const ctor = WindowRegistry.Resolve(_name);
		if (ctor === null)
			throw new Error(`[UIManager] 미등록 UserControl: ${_name}`);
		const created: UIElement = new ctor();
		if (!(created instanceof UserControl))
			throw new Error(`[UIManager] UserControl 아님: ${_name}`);
		created.AttachToManager(UIManager.Active as Window, _data ?? created.DataList);
		return created;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창을 다시 읽는다. DataList 스냅샷 복원, 실패면 이전 XML로 롤백.
	// @param _window: 창
	public static async Reload(_window: Window): Promise<boolean>
	{
		const name = UIManager.NameOf(_window);
		if (name === null || UIManager.s_provider_ === null)
			return false;
		const xml = await UIManager.s_provider_.Resolve(name);
		if (xml === null)
			return false;
		const snapshot = _window.DataList.Snapshot();
		UIManager.s_graphs_.get(_window)?.Clear(_window);
		_window.ClearChildren();
		const prev = UIManager.s_xml_.get(name);
		const graph = new BindingGraph();
		UIManager.s_graphs_.set(_window, graph);
		const ctx = UIManager.CreateContext();
		ctx.Graph = graph;
		const result = XmlLoader.LoadWindowInto(_window, xml, ctx);
		if (!result.Ok)
		{
			if (prev !== undefined)
			{
				const rollback = UIManager.CreateContext();
				rollback.Graph = graph;
				XmlLoader.LoadWindowInto(_window, prev, rollback);
			}
			_window.DataList.Restore(snapshot);
			return false;
		}
		UIManager.s_xml_.set(name, xml);
		_window.DataList.Restore(snapshot);
		_window.InitForManager(_window.DataList);
		_window.NotifyShown();
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 레이아웃 이름으로 열린 창을 다시 읽는다. 핫리로드용.
	// @param _name: 레이아웃 이름
	public static async ReloadByLayout(_name: string): Promise<boolean>
	{
		const win = UIManager.s_windows_.get(_name);
		if (win === undefined)
			return false;
		return UIManager.Reload(win);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 토스트를 띄운다. 최대 5개, 오래된 것부터 제거.
	// @param _opts: 옵션
	public static ShowToast(_opts: IToastOptions): void
	{
		const layer = UIManager.s_layers_.get(UILayerKind.Toast);
		if (layer === undefined)
			return;
		while (layer.Element.querySelectorAll(".gui-toast").length >= 5)
			layer.Element.querySelector(".gui-toast")?.remove();
		const toast = document.createElement("div");
		toast.className = `gui-toast variant-${(_opts.Variant ?? ToastKind.Info).toLowerCase()}`;
		const title = document.createElement("div");
		title.className = "gui-toast__title";
		title.textContent = _opts.Title;
		toast.append(title);
		if (_opts.Message !== undefined)
		{
			const msg = document.createElement("div");
			msg.textContent = _opts.Message;
			toast.append(msg);
		}
		layer.Element.append(toast);
		const ms = _opts.DurationMs ?? 4000;
		if (ms > 0)
		{
			setTimeout(() =>
			{
				toast.remove();
			}, ms);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// WindowShown 구독. Shell 사이드바 등이 사용.
	// @param _handler: 핸들러
	public static AddShown(_handler: (_w: Window) => void): void
	{
		UIManager.s_shownHandlers_.push(_handler);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// WindowClosed 구독.
	// @param _handler: 핸들러
	public static AddClosed(_handler: (_w: Window) => void): void
	{
		UIManager.s_closedHandlers_.push(_handler);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// LoadContext 공장을 둔다. App이 Settings/Commands를 꽂는다.
	// @param _factory: 공장
	public static SetContextFactory(_factory: () => LoadContext): void
	{
		UIManager.s_contextFactory_ = _factory;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 문맥을 만든다. 공장 없으면 빈 문맥. Plugin 로더도 사용.
	public static CreateContext(): LoadContext
	{
		if (UIManager.s_contextFactory_ !== null)
			return UIManager.s_contextFactory_();
		return new LoadContext();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창 인스턴스를 만든다. 등록 없으면 기본 Window.
	// @param _name: 창 이름
	// @param _data: 초기 데이터
	private static Create(_name: string): Window
	{
		const ctor: WindowCtor | null = WindowRegistry.Resolve(_name);
		const created: UIElement = ctor !== null ? new ctor() : new Window();
		if (!(created instanceof Window))
			throw new Error(`[UIManager] Window 아님: ${_name}`);
		const win = created;
		UIManager.s_windows_.set(_name, win);
		return win;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// XML을 읽어 창에 채운다. 데이터 오버라이드는 선언된 키만.
	// @param _win: 창
	// @param _name: 창 이름
	// @param _data: 오버라이드
	private static async LoadInto(_win: Window, _name: string, _data?: Record<string, unknown>): Promise<void>
	{
		if (UIManager.s_provider_ === null)
			return;
		const xml = await UIManager.s_provider_.Resolve(_name);
		if (xml === null)
			return;
		const graph = new BindingGraph();
		UIManager.s_graphs_.set(_win, graph);
		const ctx = UIManager.CreateContext();
		ctx.Graph = graph;
		const result = XmlLoader.LoadWindowInto(_win, xml, ctx);
		if (!result.Ok)
			throw new Error(`[UIManager] 로드 실패: ${_name}: ${result.Errors[0]?.Text ?? ""}`);
		UIManager.s_xml_.set(_name, xml);
		if (_data !== undefined)
		{
			for (const [key, value] of Object.entries(_data))
			{
				if (_win.DataList.Has(key))
					_win.DataList.Set(key, value);
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 레이어에 올린다. Dialog면 백드롭 표시.
	// @param _win: 창
	// @param _layer: 레이어
	private static Place(_win: Window, _layer: UILayerKind): void
	{
		_win.Layer = _layer;
		const layer = UIManager.s_layers_.get(_layer);
		if (layer === undefined)
			throw new Error(`[UIManager] 레이어 없음: ${_layer}`);
		if (_layer === UILayerKind.Dialog)
			layer.Element.classList.add("has-backdrop");
		layer.Push(_win);
		_win.NotifyLoaded();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 레이어에서 창을 뺀다.
	// @param _win: 창
	private static RemoveFromLayers(_win: Window): void
	{
		for (const layer of UIManager.s_layers_.values())
			layer.Remove(_win);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창 이름 역조회. 같은 이름 1개만 열린다고 가정(P1).
	// @param _win: 창
	private static NameOf(_win: Window): string | null
	{
		for (const [name, win] of UIManager.s_windows_)
		{
			if (win === _win)
				return name;
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Base 레이어 입력 차단 토글.
	// @param _on: 차단 여부
	private static SetBaseInert(_on: boolean): void
	{
		const base = UIManager.s_layers_.get(UILayerKind.Base);
		if (base === undefined)
			return;
		if (_on)
			base.Element.setAttribute("inert", "");
		else
			base.Element.removeAttribute("inert");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창의 첫 focusable에 포커스.
	// @param _win: 창
	private static FocusFirst(_win: Window): void
	{
		const found = _win.Element.querySelector<HTMLElement>("[tabindex='0'], button, input");
		if (found !== null)
			found.focus({ preventScroll: true });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Shown 통지.
	// @param _win: 창
	private static EmitShown(_win: Window): void
	{
		for (const handler of [...UIManager.s_shownHandlers_])
			handler(_win);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Closed 통지.
	// @param _win: 창
	private static EmitClosed(_win: Window): void
	{
		for (const handler of [...UIManager.s_closedHandlers_])
			handler(_win);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테스트용 전체 리셋.
	public static Reset(): void
	{
		UIManager.CloseAll();
		InputDispatcher.Detach();
		for (const layer of UIManager.s_layers_.values())
			layer.Element.remove();
		UIManager.s_layers_.clear();
		UIManager.s_windows_.clear();
		UIManager.s_xml_.clear();
		UIManager.s_graphs_.clear();
		UIManager.s_dialogs_.clear();
		UIManager.s_shownHandlers_ = [];
		UIManager.s_closedHandlers_ = [];
		UIManager.s_root_ = null;
		UIManager.s_provider_ = null;
		UIManager.s_inited_ = false;
	}
}

class UIManagerRoot extends UIElement
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 루트 div를 만든다.
	public constructor()
	{
		super();
	}
}
