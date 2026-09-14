/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ShellWindow. 사이드바·프레젠터·명령·설정 구독을 묶는다.
*/

import { Window, Border, Button, Grid, GridSplitter, StackPanel, ContentPresenter, TextBox, TitleBar, DataList, UIManager, UILayerKind, RegisterWindow, Visibility, GridLength } from "@scouter/gui";
import type { UserControl, KeyEventArgs } from "@scouter/gui";
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
import type { IPluginHandle } from "../Plugin/PluginManager";
import { PluginOrder } from "../Plugin/PluginOrder";
import { PluginGroups } from "../Plugin/PluginGroups";
import type { TPluginGroupArea } from "../Plugin/PluginGroups";
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
	private readonly viewHandles_ = new Map<string, IPluginHandle>();
	private viewOrder_: string[] = [];
	private selectedId_ = "";

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 사이드바 선택 → 콘텐츠 스와프. 이전 뷰는 캐시. 빈 Id면 콘텐츠를 비운다.
	// @param _pluginId: 뷰 Id
	public Navigate(_pluginId: string): void
	{
		if (_pluginId.length === 0)
		{
			this.presenter_.Detach();
			this.selectedId_ = "";
			return;
		}
		this.RecordClick(_pluginId);
		if (!this.ShowView(_pluginId))
			return;
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
	// 리로드 중이라 콘텐츠가 잠시 비어도 선택 Id로 답한다.
	public CurrentPluginId(): string
	{
		const shown = (this.presenter_.Content as UserControl | null)?.PluginId ?? "";
		return shown.length > 0 ? shown : this.selectedId_;
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
		this.PreviewKeyDown.Add((_s, _a) => { this.OnPreviewKey(_a); });
		Settings.Changed.Add((_change) => { this.OnSettingsChanged(_change.Key); });
		Ipc.On("app:open-settings", () => { this.OpenSettings(); });
		PluginManager.Changed.Add(() => { this.SyncFromPlugins(); });
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
		this.SyncFromPlugins();
		const last = Settings.Get<string>("Ui.LastPluginId", "");
		const target = PluginManager.Has(last) ? last : (PluginManager.List()[0]?.Id ?? "Shell/Welcome");
		this.Navigate(target);
		this.sidebar_.Focus(target);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 창 안에 포커스가 있을 때도 전역 단축키가 먹도록 창 터널 단계에서 한 번 더 본다.
	// Hotkeys는 UIManager.Root의 PreviewKeyDown에 붙는데 창 트리는 그 자식이 아니다.
	// InputDispatcher는 document.activeElement에서 라우팅하므로, 창 안이 포커스면 Root 핸들러까지 가지 않는다.
	// 조합 판정은 Hotkeys가 실제로 들고 있는 바인딩(HotkeyOf)으로만 하므로 표가 둘로 갈리지 않는다.
	// @param _a: 키 인자
	private OnPreviewKey(_a: KeyEventArgs): void
	{
		if (_a.Handled)
			return;
		const chord = ShellWindow.ChordOf(_a);
		for (const def of CommandRegistry.List())
		{
			if (Hotkeys.HotkeyOf(def.Id) !== chord)
				continue;
			if (!CommandRegistry.CanExecute(def.Id))
				return;
			void CommandRegistry.Execute(def.Id);
			_a.Handled = true;
			return;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 인자에서 단축키 조합 문자열을 만든다. Hotkeys.Normalize와 같은 표기로 맞춘다.
	// @param _a: 키 인자
	private static ChordOf(_a: KeyEventArgs): string
	{
		const parts: string[] = [];
		if (_a.Ctrl)
			parts.push("ctrl");
		if (_a.Shift)
			parts.push("shift");
		if (_a.Alt)
			parts.push("alt");
		if (_a.Meta)
			parts.push("meta");
		parts.push(_a.Key.length === 1 ? _a.Key : _a.Code);
		return Hotkeys.Normalize(parts.join("+"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin 목록을 사이드바에 동기화한다. 영역 → 그룹 → 항목 구조는 SidebarController가 그린다.
	// 정렬기준은 그룹 구조를 덮지 않는다. 그룹 안 나열 순서만 바꾸므로 여기서는 평탄한 목록만 넘긴다.
	// 리로드 중 잠시 Disabled가 되는 Plugin도 목록에 남긴다. 목록이 깜빡이면 선택·스크롤이 날아가기 때문이다.
	private SyncFromPlugins(): void
	{
		const listed = PluginManager.List();
		this.PruneViews();
		const sort = PluginOrder.NormalizeSort(Settings.Get<unknown>("Ui.SidebarSort", "Custom"));
		const ids = listed.map((_p) => _p.Id);
		const seen = Settings.Get<Record<string, number>>("Ui.PluginFirstSeen", {});
		const ensuredSeen = PluginOrder.EnsureFirstSeen(seen, ids, Date.now());
		if (JSON.stringify(ensuredSeen) !== JSON.stringify(seen))
			Settings.Set("Ui.PluginFirstSeen", ensuredSeen);
		const builtIn = PluginOrder.SortBuiltIn(listed.filter((_p) => _p.Source === "BuiltIn"));
		const external = listed.filter((_p) => _p.Source !== "BuiltIn");
		const externalIds = external.map((_p) => _p.Id);
		ShellWindow.MigrateGroupsOnce(externalIds);
		const groups = PluginGroups.Normalize(Settings.Get<unknown>("Ui.PluginGroups", null), builtIn.map((_p) => _p.Id), externalIds);
		const clicks = Settings.Get<Record<string, number>>("Ui.PluginClicks", {});
		this.sidebar_.Sync([...builtIn, ...external].map((_p) => ({ Id: _p.Id, Title: _p.Name, Icon: "package", Source: _p.Source, State: _p.State })), {
			SortMode: sort,
			Groups: groups,
			Clicks: clicks,
			Seen: ensuredSeen,
			AreaCollapsed: ShellWindow.AreaCollapsed(),
			OnOrderChanged: (_area, _itemId, _groupId, _index) => { ShellWindow.SaveItemMove(_area, _itemId, _groupId, _index); },
			OnGroupsChanged: (_state) => { Settings.Set("Ui.PluginGroups", _state); },
			OnAreaCollapsedChanged: (_area, _collapsed) => { ShellWindow.SaveAreaCollapsed(_area, _collapsed); },
		});
		this.RestoreSelection();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기존 Ui.PluginOrder를 그룹 구조로 딱 한 번 옮긴다. 이관 뒤에는 NeedsMigration이 false라 다시 덮지 않는다.
	// Ui.PluginOrder는 지우지 않고 레거시(읽기 전용)로 남긴다.
	// @param _externalIds: 현재 외부 Plugin Id
	private static MigrateGroupsOnce(_externalIds: string[]): void
	{
		if (!PluginGroups.NeedsMigration(Settings.Get<unknown>("Ui.PluginGroups", null)))
			return;
		const order = Settings.Get<string[]>("Ui.PluginOrder", []);
		if (order.length === 0)
			return;
		Settings.Set("Ui.PluginGroups", PluginGroups.MigrateFromOrder(order, _externalIds));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 영역 접힘 설정을 읽는다. 저장값이 깨져 있어도 두 영역 모두 boolean으로 굳힌다.
	private static AreaCollapsed(): Record<TPluginGroupArea, boolean>
	{
		const raw = Settings.Get<Record<string, unknown>>("Ui.SidebarAreaCollapsed", {});
		return { System: raw["System"] === true, External: raw["External"] === true };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 영역 접힘을 저장한다.
	// @param _area: 영역
	// @param _collapsed: 접힘 여부
	private static SaveAreaCollapsed(_area: TPluginGroupArea, _collapsed: boolean): void
	{
		const next = ShellWindow.AreaCollapsed();
		next[_area] = _collapsed;
		Settings.Set("Ui.SidebarAreaCollapsed", next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 이동을 저장한다. 저장된 구조에 같은 이동을 다시 적용한다.
	// @param _area: 영역
	// @param _itemId: Plugin Id
	// @param _groupId: 대상 그룹 Id
	// @param _index: 대상 그룹에서 제거 후 기준 삽입 위치
	private static SaveItemMove(_area: TPluginGroupArea, _itemId: string, _groupId: string, _index: number): void
	{
		const current = PluginGroups.Normalize(Settings.Get<unknown>("Ui.PluginGroups", null), [], []);
		const next = PluginGroups.MoveItem(current, _area, _itemId, _groupId, _index);
		if (next === current)
			return;
		Settings.Set("Ui.PluginGroups", next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 낡은 캐시 뷰를 버린다. Plugin이 사라졌거나 리로드로 핸들이 바뀐 경우다.
	// 리로드가 끝나기 전까지는 보고 있던 뷰를 그대로 두어 콘텐츠가 비는 순간을 없앤다.
	private PruneViews(): void
	{
		for (const id of [...this.views_.keys()])
		{
			if (id === "Shell/Welcome")
				continue;
			const handle = PluginManager.Get(id);
			if (handle !== null && handle === this.viewHandles_.get(id))
				continue;
			this.DropView(id);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 캐시 뷰 1개를 떼고 버린다. 선택 상태는 건드리지 않는다.
	// @param _pluginId: 뷰 Id
	private DropView(_pluginId: string): void
	{
		const stale = this.views_.get(_pluginId);
		this.views_.delete(_pluginId);
		this.viewHandles_.delete(_pluginId);
		if (stale === undefined)
			return;
		if (this.presenter_.Content === stale)
			this.presenter_.Detach();
		stale.Dispose();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택을 유지한다. 보고 있던 뷰가 리로드로 버려졌으면 새 뷰를 만들어 콘텐츠 영역에 다시 꽂는다.
	// 아직 Loading·Disabled면 아무것도 하지 않는다. 다음 Changed에서 다시 들어온다.
	private RestoreSelection(): void
	{
		const selected = this.selectedId_.length > 0 ? this.selectedId_ : Settings.Get<string>("Ui.LastPluginId", "");
		if (selected.length === 0)
			return;
		if (this.sidebar_.Find(selected) !== null)
			this.sidebar_.Select(selected);
		if (this.presenter_.Content !== null)
			return;
		const state = PluginManager.Get(selected)?.State ?? null;
		if (selected !== "Shell/Welcome" && state !== "Active" && state !== "Error")
			return;
		this.ShowView(selected);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 캐시 뷰를 콘텐츠 영역에 건다. 클릭 집계·마지막 Id 저장은 하지 않는다.
	// @param _pluginId: 뷰 Id
	private ShowView(_pluginId: string): boolean
	{
		const view = this.ResolveView(_pluginId);
		if (view === null)
			return false;
		if (this.presenter_.Content !== view)
			this.presenter_.Content = view;
		if (!this.viewOrder_.includes(_pluginId))
			this.viewOrder_.push(_pluginId);
		this.selectedId_ = _pluginId;
		this.sidebar_.Select(_pluginId);
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 캐시 뷰를 구한다. 없으면 만들어 캐시한다. 만들 때의 Plugin 핸들도 같이 적어 리로드를 판별한다.
	// @param _pluginId: 뷰 Id
	private ResolveView(_pluginId: string): UserControl | null
	{
		const cached = this.views_.get(_pluginId);
		if (cached !== undefined)
			return cached;
		if (_pluginId === "Shell/Welcome")
		{
			const welcome = new WelcomeControl();
			welcome.AttachToManager(this, welcome.DataList);
			this.views_.set(_pluginId, welcome);
			return welcome;
		}
		const handle = PluginManager.Get(_pluginId);
		if (handle === null)
			return null;
		const created = PluginManager.CreateMainView(_pluginId);
		this.views_.set(_pluginId, created);
		this.viewHandles_.set(_pluginId, handle);
		return created;
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
		if (_key === "Ui.SidebarSort" || _key === "Ui.PluginGroups" || _key === "Ui.SidebarAreaCollapsed" || _key === "Ui.PluginClicks" || _key === "Ui.PluginFirstSeen")
			this.SyncFromPlugins();
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
