/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ShellWindow. 사이드바·프레젠터·명령·설정 구독을 묶는다.
*/

import { Window, Border, Button, Grid, GridSplitter, StackPanel, ContentPresenter, TextBox, TitleBar, DataList, UIManager, UILayerKind, RegisterWindow, Visibility, GridLength } from "@scouter/gui";
import type { UserControl } from "@scouter/gui";
import { Settings } from "../Services/Settings";
import { Paths } from "../Services/Paths";
import { Ipc } from "../Services/Ipc";
import { Hotkeys } from "../Services/Hotkeys";
import { CommandRegistry } from "../Services/CommandRegistry";
import { SidebarController } from "./SidebarController";
import { ShellCommands } from "./ShellCommands";
import { IpcWindowChrome } from "./IpcWindowChrome";
import { WelcomeControl } from "./WelcomeControl";
import { PluginManager } from "../Plugin/PluginManager";
import { PluginOrder } from "../Plugin/PluginOrder";
import { McpHttpServer } from "../Mcp/McpHttpServer";

@RegisterWindow("Shell")
export class ShellWindow extends Window
{
	// ==================== 정적 ====================
	private static s_commandsRegistered_ = false;

	// ==================== 멤버 ====================
	private sidebar_!: SidebarController;
	private presenter_!: ContentPresenter;
	private expandTab_: Button | null = null;
	private readonly views_ = new Map<string, UserControl>();
	private viewOrder_: string[] = [];

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 사이드바 선택 → 콘텐츠 스와프. 이전 뷰는 캐시.
	// @param _pluginId: 뷰 Id
	public Navigate(_pluginId: string): void
	{
		const prev = this.presenter_.Detach();
		if (prev instanceof WelcomeControl)
			this.views_.set("Shell/Welcome", prev);
		if (_pluginId.length === 0)
			return;
		let view = this.views_.get(_pluginId);
		if (view === undefined && _pluginId === "Shell/Welcome")
		{
			view = new WelcomeControl();
			view.AttachToManager(this, view.DataList);
			this.views_.set(_pluginId, view);
		}
		if (view === undefined && PluginManager.Has(_pluginId))
			view = PluginManager.CreateMainView(_pluginId);
		if (view === undefined)
			return;
		if (!this.viewOrder_.includes(_pluginId))
			this.viewOrder_.push(_pluginId);
		this.RecordClick(_pluginId);
		this.presenter_.Content = view;
		this.sidebar_.Select(_pluginId);
		Settings.Set("Ui.LastPluginId", _pluginId);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 뷰 순환. Ctrl+Tab용.
	// @param _dir: 방향
	public CycleView(_dir: number): void
	{
		if (this.viewOrder_.length < 2)
			return;
		const current = this.viewOrder_.findIndex((_id) => (this.presenter_.Content as UserControl | null)?.PluginId === _id);
		const next = this.viewOrder_[(current + _dir + this.viewOrder_.length) % this.viewOrder_.length] as string;
		this.Navigate(next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 다이얼로그를 연다.
	public OpenSettings(): void
	{
		void UIManager.ShowDialogAsync("Settings");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 정보 다이얼로그를 연다. 버전은 About 창이 직접 채운다.
	public OpenAbout(): void
	{
		void UIManager.ShowDialogAsync("About");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 지금 열린 Plugin Id를 구한다. 없으면 빈 문자열. F5 리로드용.
	public CurrentPluginId(): string
	{
		return (this.presenter_.Content as UserControl | null)?.PluginId ?? "";
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨트롤을 잡고 명령·구독을 건다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.presenter_ = this.RequireName(ContentPresenter, "content");
		this.sidebar_ = new SidebarController(this.RequireName(StackPanel, "plugin_list"), this);
		const filter = this.RequireName(TextBox, "txt_plugin_filter");
		filter.TextChanged.Add(() => { this.sidebar_.Filter(filter.Text); });
		this.RequireName(GridSplitter, "splitter").DragCompleted.Add(() => { this.OnSplitterCompleted(); });
		this.RequireName(TitleBar, "title_bar").Chrome = new IpcWindowChrome();
		if (!ShellWindow.s_commandsRegistered_)
		{
			ShellWindow.s_commandsRegistered_ = true;
			ShellCommands.Register(this);
		}
		for (const def of CommandRegistry.List())
		{
			if (def.Hotkey !== undefined)
				Hotkeys.Bind(def.Hotkey, def.Id);
		}
		Settings.Changed.Add((_change) => { this.OnSettingsChanged(_change.Key); });
		Ipc.On("app:open-settings", () => { this.OpenSettings(); });
		PluginManager.Changed.Add(() => { this.RebuildFromPlugins(); });
		McpHttpServer.SessionsChanged.Add(() =>
		{
			_data.Set("mcpSessions", McpHttpServer.SessionList().length);
		});
		_data.Set("appVersion", Paths.Version);
		_data.Set("mcpPort", Settings.Get<number>("Mcp.Port"));
		this.ClearExpandTab();
		this.ApplySidebarWidth();
		this.ApplyNativeFrame();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 첫 화면을 정한다. 마지막 Plugin, 없으면 환영 뷰. 복원 뒤 사이드바에 포커스.
	protected override OnShown(): void
	{
		this.RebuildFromPlugins();
		const last = Settings.Get<string>("Ui.LastPluginId", "");
		const target = PluginManager.Has(last) ? last : (PluginManager.List()[0]?.Id ?? "Shell/Welcome");
		this.Navigate(target);
		this.sidebar_.Focus(target);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin 목록으로 사이드바를 다시 그린다. 시스템은 위(항상 알파벳), 외부는 아래(정렬기준).
	private RebuildFromPlugins(): void
	{
		const active = PluginManager.List().filter((_p) => _p.State === "Active" || _p.State === "Error");
		for (const id of [...this.views_.keys()])
		{
			if (id !== "Shell/Welcome" && !active.some((_p) => _p.Id === id))
			{
				const stale = this.views_.get(id);
				if (stale !== undefined)
				{
					if (this.presenter_.Content === stale)
						this.presenter_.Detach();
					stale.Dispose();
				}
				this.views_.delete(id);
			}
		}
		const sort = PluginOrder.NormalizeSort(Settings.Get<unknown>("Ui.SidebarSort", "Custom"));
		const ids = active.map((_p) => _p.Id);
		const seen = Settings.Get<Record<string, number>>("Ui.PluginFirstSeen", {});
		const ensuredSeen = PluginOrder.EnsureFirstSeen(seen, ids, Date.now());
		if (JSON.stringify(ensuredSeen) !== JSON.stringify(seen))
			Settings.Set("Ui.PluginFirstSeen", ensuredSeen);
		const builtIn = PluginOrder.SortBuiltIn(active.filter((_p) => _p.Source === "BuiltIn"));
		const external = active.filter((_p) => _p.Source !== "BuiltIn");
		const order = Settings.Get<string[]>("Ui.PluginOrder", []);
		const ensured = PluginOrder.EnsureExternalOrder(order, external.map((_p) => _p.Id));
		if (ensured.length !== order.length)
			Settings.Set("Ui.PluginOrder", ensured);
		const clicks = Settings.Get<Record<string, number>>("Ui.PluginClicks", {});
		const sortedExternal = PluginOrder.SortExternal(external, ensured, clicks, ensuredSeen, sort);
		this.sidebar_.Rebuild([...builtIn, ...sortedExternal].map((_p) => ({ Id: _p.Id, Title: _p.Name, Icon: "package", Source: _p.Source, State: _p.State })), {
			SortMode: sort,
			OnOrderChanged: (_ids) => { Settings.Set("Ui.PluginOrder", _ids); },
		});
		const current = (this.presenter_.Content as UserControl | null)?.PluginId ?? Settings.Get<string>("Ui.LastPluginId", "");
		if (current.length > 0 && this.sidebar_.Find(current) !== null)
			this.sidebar_.Select(current);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이동 클릭을 셈한다. 클릭 많은 순 정렬용. 환영 뷰는 세지 않는다.
	// @param _pluginId: Plugin Id
	private RecordClick(_pluginId: string): void
	{
		if (!PluginManager.Has(_pluginId))
			return;
		const clicks = Settings.Get<Record<string, number>>("Ui.PluginClicks", {});
		Settings.Set("Ui.PluginClicks", { ...clicks, [_pluginId]: (clicks[_pluginId] ?? 0) + 1 });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스플리터 확정값을 설정에 저장한다.
	private OnSplitterCompleted(): void
	{
		const col = this.RequireName(Grid, "root").ColumnDefinitions.Get(0);
		Settings.Set("Ui.SidebarWidth", Math.round(col.Length.Value));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 변경을 화면에 반영한다. 접힘·폭·프레임.
	// @param _key: 설정 키
	private OnSettingsChanged(_key: string): void
	{
		if (_key === "Ui.SidebarCollapsed" || _key === "Ui.SidebarWidth")
			this.ApplySidebarWidth();
		if (_key === "Ui.SidebarSort" || _key === "Ui.PluginOrder" || _key === "Ui.PluginClicks" || _key === "Ui.PluginFirstSeen")
			this.RebuildFromPlugins();
		if (_key === "Ui.NativeFrame")
			this.ApplyNativeFrame();
		if (_key === "Mcp.Port")
			this.DataList.Set("mcpPort", Settings.Get<number>("Mcp.Port"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사이드바 열을 적용한다. 접힘이면 통째로 숨긴다(Collapsed).
	private ApplySidebarWidth(): void
	{
		const collapsed = Settings.Get<boolean>("Ui.SidebarCollapsed");
		const grid = this.TryFindGrid();
		if (grid === null)
			return;
		const col = grid.ColumnDefinitions.Get(0);
		const gap = grid.ColumnDefinitions.Get(1);
		const sidebar = this.FindName(Border, "sidebar");
		const splitter = this.FindName(GridSplitter, "splitter");
		if (collapsed)
		{
			col.MinWidth = 0;
			col.MaxWidth = 0;
			col.Length = GridLength.Pixel(0);
			gap.Length = GridLength.Pixel(0);
			if (sidebar !== null)
				sidebar.Visibility = Visibility.Collapsed;
			if (splitter !== null)
				splitter.Visibility = Visibility.Collapsed;
			this.SetExpandTab(true);
		}
		else
		{
			const width = Settings.Get<number>("Ui.SidebarWidth");
			col.MinWidth = 48;
			col.MaxWidth = 600;
			col.Length = GridLength.Pixel(width);
			gap.Length = GridLength.Pixel(8);
			if (sidebar !== null)
				sidebar.Visibility = Visibility.Visible;
			if (splitter !== null)
				splitter.Visibility = Visibility.Visible;
			this.SetExpandTab(false);
		}
		grid.InvalidateTemplate();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 펼치기 탭을 띄우거나 내린다. 접힘 상태에서만 좌측에 둔다.
	// @param _show: 표시 여부
	private SetExpandTab(_show: boolean): void
	{
		if (_show && this.expandTab_ === null)
		{
			const btn = new Button();
			btn.Name = "btn_expand";
			btn.Icon = "chevrons-right";
			btn.ToolTip = "사이드바 펼치기 (Ctrl+B)";
			btn.Element.classList.add("gui-expandtab");
			btn.Click.Add(() => { Settings.Set("Ui.SidebarCollapsed", false); });
			UIManager.LayerElement(UILayerKind.Overlay)?.append(btn.Element);
			this.expandTab_ = btn;
		}
		else if (!_show)
			this.ClearExpandTab();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 펼치기 탭을 버린다. 리로드 대비.
	private ClearExpandTab(): void
	{
		this.expandTab_?.Dispose();
		this.expandTab_ = null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 네이티브 프레임이면 타이틀바를 숨긴다.
	private ApplyNativeFrame(): void
	{
		const native = Settings.Get<boolean>("Ui.NativeFrame");
		this.RequireName(TitleBar, "title_bar").Visibility = native ? Visibility.Collapsed : Visibility.Visible;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 루트 Grid를 찾는다. 없으면 null.
	private TryFindGrid(): Grid | null
	{
		return this.FindName(Grid, "root");
	}
}
