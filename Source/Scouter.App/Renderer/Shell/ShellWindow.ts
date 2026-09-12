/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ShellWindow. 사이드바·프레젠터·명령·설정 구독을 묶는다.
*/

import { Window, Grid, GridSplitter, StackPanel, ContentPresenter, TitleBar, DataList, UIManager, RegisterWindow, Visibility, GridLength } from "@scouter/gui";
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
import { McpHttpServer } from "../Mcp/McpHttpServer";

@RegisterWindow("Shell")
export class ShellWindow extends Window
{
	// ==================== 정적 ====================
	private static s_commandsRegistered_ = false;

	// ==================== 멤버 ====================
	private sidebar_!: SidebarController;
	private presenter_!: ContentPresenter;
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

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨트롤을 잡고 명령·구독을 건다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.presenter_ = this.RequireName(ContentPresenter, "content");
		this.sidebar_ = new SidebarController(this.RequireName(StackPanel, "plugin_list"), this);
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
		this.ApplySidebarWidth();
		this.ApplyNativeFrame();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 첫 화면을 정한다. 마지막 Plugin, 없으면 환영 뷰.
	protected override OnShown(): void
	{
		this.RebuildFromPlugins();
		const last = Settings.Get<string>("Ui.LastPluginId", "");
		this.Navigate(PluginManager.Has(last) ? last : (PluginManager.List()[0]?.Id ?? "Shell/Welcome"));
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin 목록으로 사이드바를 다시 그린다.
	private RebuildFromPlugins(): void
	{
		const active = PluginManager.List().filter((_p) => _p.State === "Active");
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
		this.sidebar_.Rebuild(active.map((_p) => ({ Id: _p.Id, Title: _p.Name, Icon: "package" })));
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
		if (_key === "Ui.NativeFrame")
			this.ApplyNativeFrame();
		if (_key === "Mcp.Port")
			this.DataList.Set("mcpPort", Settings.Get<number>("Mcp.Port"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사이드바 열 폭을 적용한다. 접힘이면 48.
	private ApplySidebarWidth(): void
	{
		const collapsed = Settings.Get<boolean>("Ui.SidebarCollapsed");
		const width = collapsed ? 48 : Settings.Get<number>("Ui.SidebarWidth");
		const grid = this.TryFindGrid();
		if (grid === null)
			return;
		const col = grid.ColumnDefinitions.Get(0);
		col.MinWidth = collapsed ? 48 : 100;
		col.MaxWidth = collapsed ? 48 : 400;
		col.Length = GridLength.Pixel(width);
		grid.InvalidateTemplate();
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
