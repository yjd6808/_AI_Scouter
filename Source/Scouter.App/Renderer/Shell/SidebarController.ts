/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SidebarController. Plugin 목록을 영역 → 그룹 → 항목 3단으로 그린다. 시스템·외부 영역 분리 + 영역 안 드래그 정렬.
	드래그는 같은 영역이면 다른 그룹으로도 간다. 항목 사이와 그룹 헤더(빈 그룹·접힌 그룹)를 모두 드롭 대상으로 잡는다.
	통째로 다시 만들지 않는다. 항목 배열을 평탄한 렌더 노드 배열로 계산한 뒤 현재 자식과 비교해 최소 변경만 반영한다.
	그룹 구조는 PluginGroups.Normalize를 통과한 값만 쓴다. 저장 원본(Ui.PluginGroups)을 직접 그리지 않는다.
*/

import { StackPanel, ToggleButton, ContextMenu, MenuItem, ToastService, UIElement } from "@scouter/gui";
import type { PluginNotice, PluginSource, PluginState } from "../Plugin/PluginManager";
import { PluginManager } from "../Plugin/PluginManager";
import { PluginOrder } from "../Plugin/PluginOrder";
import type { TSidebarSort } from "../Plugin/PluginOrder";
import { PluginGroups } from "../Plugin/PluginGroups";
import type { IPluginGroup, IPluginGroupState, TPluginGroupArea } from "../Plugin/PluginGroups";
import { SidebarGroupHeader } from "./SidebarGroupHeader";
import type { ShellWindow } from "./ShellWindow";

export interface ISidebarItem
{
	Id: string;
	Title: string;
	Icon: string;
	Source: PluginSource;
	State: PluginState;
}

export interface ISidebarOptions
{
	SortMode?: string;
	Groups?: IPluginGroupState;
	Clicks?: Record<string, number>;
	Seen?: Record<string, number>;
	AreaCollapsed?: Record<TPluginGroupArea, boolean>;
	OnOrderChanged?: (_area: TPluginGroupArea, _itemId: string, _targetGroupId: string, _index: number) => void;
	OnGroupsChanged?: (_state: IPluginGroupState) => void;
	OnAreaCollapsedChanged?: (_area: TPluginGroupArea, _collapsed: boolean) => void;
}

export type TSidebarNodeKind = "Header" | "Group" | "Item";
export type TSidebarDropKind = "Item" | "Group";

export interface ISidebarDrop
{
	Kind: TSidebarDropKind;
	Key: string;
	After: boolean;
}

export interface ISidebarNode
{
	Kind: TSidebarNodeKind;
	Key: string;
	Text: string;
	Depth: number;
	Area: TPluginGroupArea;
	GroupId: string;
	Collapsed: boolean;
	CanRename: boolean;
	Item: ISidebarItem | null;
	Draggable: boolean;
}

interface IOrderEntryItem extends ISidebarItem
{
	Name: string;
}

interface IItemView
{
	Button: ToggleButton;
	Title: string;
	Notice: PluginNotice | null;
	Draggable: boolean;
	Depth: number;
}

interface IDragState
{
	Id: string;
	Area: TPluginGroupArea;
	StartX: number;
	StartY: number;
	Active: boolean;
	Spot: ISidebarDrop | null;
}

interface IDropHit
{
	Kind: TSidebarDropKind;
	Area: TPluginGroupArea;
	Key: string;
	Element: Element;
}

export class SidebarController
{
	// ==================== 정적 ====================
	private static readonly s_newGroupName_ = "새 그룹";

	// ==================== 멤버 ====================
	private readonly list_: StackPanel;
	private readonly shell_: ShellWindow;
	private readonly items_ = new Map<string, IItemView>();
	private readonly headers_ = new Map<string, SidebarGroupHeader>();
	private system_: ISidebarItem[] = [];
	private external_: ISidebarItem[] = [];
	private groups_: IPluginGroupState = PluginGroups.Empty();
	private areaCollapsed_: Record<TPluginGroupArea, boolean> = { System: false, External: false };
	private clicks_: Record<string, number> = {};
	private seen_: Record<string, number> = {};
	private filter_ = "";
	private sortMode_ = "Custom";
	private orderChanged_: ((_area: TPluginGroupArea, _itemId: string, _targetGroupId: string, _index: number) => void) | null = null;
	private groupsChanged_: ((_state: IPluginGroupState) => void) | null = null;
	private areaCollapsedChanged_: ((_area: TPluginGroupArea, _collapsed: boolean) => void) | null = null;
	private moveMenu_: ContextMenu | null = null;
	private drag_: IDragState | null = null;
	private onWindowMove_: ((_e: PointerEvent) => void) | null = null;
	private onWindowUp_: ((_e: PointerEvent) => void) | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록 패널로 만든다.
	// @param _list: 항목 StackPanel
	// @param _shell: 셸 창
	public constructor(_list: StackPanel, _shell: ShellWindow)
	{
		this.list_ = _list;
		this.shell_ = _shell;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 목록을 화면에 동기화한다. 시스템은 위, 외부는 아래 영역이다.
	// 그룹 구조는 넘어온 값이 없으면 직전 상태를 이어 쓰고, 어느 쪽이든 Normalize를 한 번 더 통과시킨다.
	// 같은 입력으로 다시 불러도 기존 자식을 그대로 쓰므로 DOM은 건드리지 않는다.
	// @param _items: 항목 목록
	// @param _opts: 정렬모드·그룹 구조·콜백
	public Sync(_items: ISidebarItem[], _opts?: ISidebarOptions): void
	{
		this.system_ = _items.filter((_item) => PluginGroups.AreaOf(_item.Source) === "System");
		this.external_ = _items.filter((_item) => PluginGroups.AreaOf(_item.Source) === "External");
		this.sortMode_ = _opts?.SortMode ?? "Custom";
		this.clicks_ = _opts?.Clicks ?? {};
		this.seen_ = _opts?.Seen ?? {};
		this.areaCollapsed_ = { System: _opts?.AreaCollapsed?.System ?? false, External: _opts?.AreaCollapsed?.External ?? false };
		this.orderChanged_ = _opts?.OnOrderChanged ?? null;
		this.groupsChanged_ = _opts?.OnGroupsChanged ?? null;
		this.areaCollapsedChanged_ = _opts?.OnAreaCollapsedChanged ?? null;
		const base: unknown = _opts?.Groups ?? this.groups_;
		this.groups_ = PluginGroups.Normalize(base, this.system_.map((_item) => _item.Id), this.external_.map((_item) => _item.Id));
		this.Reconcile();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 제목·Id 부분 일치로 목록을 줄인다. 빈 문자열이면 전부 보인다.
	// 검색 중에는 접힘 상태를 무시해 매칭 항목을 드러내지만 저장된 접힘 값은 건드리지 않는다.
	// @param _text: 검색어
	public Filter(_text: string): void
	{
		const query = _text.toLowerCase();
		if (query === this.filter_)
			return;
		this.filter_ = query;
		this.Reconcile();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택을 하나만 남긴다.
	// @param _pluginId: 선택 Id
	public Select(_pluginId: string): void
	{
		for (const [id, view] of this.items_)
			view.Button.IsChecked = id === _pluginId;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 항목에 포커스를 준다. 재시작 복원용.
	// @param _pluginId: 포커스 Id
	public Focus(_pluginId: string): boolean
	{
		const view = this.items_.get(_pluginId);
		if (view === undefined)
			return false;
		return view.Button.Focus();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 배지를 단다. P6에서 사용.
	// @param _pluginId: 항목 Id
	// @param _text: 배지 문구
	public SetBadge(_pluginId: string, _text: string): void
	{
		const view = this.items_.get(_pluginId);
		if (view !== undefined)
			view.Button.ToolTip = `${_pluginId} (${_text})`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 외부 영역 Id를 표시 순서대로 구한다. 그룹 나열 순서를 이어 붙인다. 테스트·저장용.
	public ExternalIds(): string[]
	{
		const known = new Set(this.external_.map((_item) => _item.Id));
		const out: string[] = [];
		for (const group of this.groups_.External)
		{
			for (const id of group.Items)
			{
				if (known.has(id))
					out.push(id);
			}
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 지금 그리고 있는 그룹 구조를 구한다. 테스트·저장용.
	public Groups(): IPluginGroupState
	{
		return this.groups_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더 요소를 구한다. 테스트용.
	// @param _area: 영역
	// @param _groupId: 그룹 Id (빈 문자열이면 영역 헤더)
	public FindHeader(_area: TPluginGroupArea, _groupId: string): SidebarGroupHeader | null
	{
		const key = _groupId.length === 0 ? SidebarController.AreaKey(_area) : `${_area}/${_groupId}`;
		return this.headers_.get(key) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 요소를 구한다. 테스트용.
	// @param _pluginId: 항목 Id
	public Find(_pluginId: string): UIElement | null
	{
		return this.items_.get(_pluginId)?.Button ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 드래그를 목표 앞으로/뒤로 옮긴다. 같은 영역·같은 그룹 안에서만 허용한다. 바뀌었으면 true + 순서 콜백.
	// 삽입 위치는 "끄는 항목을 뺀 배열" 기준이다. MoveItem이 출발 그룹에서 먼저 빼고 넣기 때문이다.
	// 다른 그룹으로 옮기려면 Drop을 쓴다.
	// @param _dragId: 끄는 Id
	// @param _targetId: 목표 Id
	// @param _after: 목표 뒤이면 true
	public MoveBefore(_dragId: string, _targetId: string, _after: boolean): boolean
	{
		if (_dragId === _targetId)
			return false;
		const area = this.AreaOfItem(_dragId);
		if (area === null || area !== this.AreaOfItem(_targetId))
			return false;
		const group = this.groups_[area].find((_candidate) => _candidate.Items.includes(_dragId));
		if (group === undefined || !group.Items.includes(_targetId))
			return false;
		const rest = group.Items.filter((_id) => _id !== _dragId);
		let at = rest.indexOf(_targetId);
		if (at < 0)
			return false;
		if (_after)
			at += 1;
		return this.ApplyItemMove(area, _dragId, group.Id, at);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 드롭 지점을 확정해 항목을 옮긴다. 같은 영역 안이면 다른 그룹으로도 간다. 바뀌었으면 true + 순서 콜백.
	// 영역을 넘는 이동은 여기서 먼저 거른다. PluginGroups.MoveItem도 구조적으로 거부하지만 표시 단계와 기준을 맞춘다.
	// 삽입 위치 기준이 두 갈래다. 같은 그룹 안이면 끄는 항목을 뺀 배열이 기준이고(MoveBefore),
	// 다른 그룹이면 출발 그룹에서만 빠지므로 대상 그룹 Items 원본이 기준이다.
	// @param _dragId: 끄는 Id
	// @param _drop: 드롭 지점. 항목이면 그 앞뒤, 그룹이면 그 그룹 맨 앞이다.
	public Drop(_dragId: string, _drop: ISidebarDrop): boolean
	{
		const area = this.AreaOfItem(_dragId);
		if (area === null)
			return false;
		if (_drop.Kind === "Group")
		{
			if (PluginGroups.FindGroup(this.groups_, area, _drop.Key) === null)
				return false;
			return this.ApplyItemMove(area, _dragId, _drop.Key, 0);
		}
		if (_drop.Key === _dragId || this.AreaOfItem(_drop.Key) !== area)
			return false;
		const group = this.groups_[area].find((_candidate) => _candidate.Items.includes(_drop.Key));
		if (group === undefined)
			return false;
		if (group.Id === this.GroupIdOf(area, _dragId))
			return this.MoveBefore(_dragId, _drop.Key, _drop.After);
		const at = group.Items.indexOf(_drop.Key);
		if (at < 0)
			return false;
		return this.ApplyItemMove(area, _dragId, group.Id, _drop.After ? at + 1 : at);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 렌더 노드를 계산하고 현재 자식과 비교해 최소한의 추가·제거·이동만 한다.
	// 목록 구성이 실제로 바뀐 경우에만 진행 중이던 드래그를 버린다.
	private Reconcile(): void
	{
		const nodes = this.BuildNodes();
		const headerKeys = new Set(nodes.filter((_node) => _node.Item === null).map((_node) => _node.Key));
		const itemKeys = new Set(nodes.filter((_node) => _node.Item !== null).map((_node) => _node.Key));
		let changed = this.Prune(itemKeys, headerKeys);
		const desired: UIElement[] = [];
		for (const node of nodes)
		{
			if (node.Item === null)
			{
				desired.push(this.RealizeHeader(node));
				continue;
			}
			const view = this.RealizeItem(node.Item, node.Depth);
			if (view.Draggable !== node.Draggable)
			{
				SidebarController.ApplyDraggable(view, node.Draggable);
				changed = true;
			}
			desired.push(view.Button);
		}
		let idx = 0;
		for (const want of desired)
		{
			if (this.list_.Children[idx] !== want)
			{
				this.list_.AddChild(want, idx);
				changed = true;
			}
			++idx;
		}
		if (changed)
			this.CancelDrag();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 화면에 놓일 자식을 순서대로 계산한다. 영역 헤더 → 그룹 헤더 → 항목 순이다.
	private BuildNodes(): ISidebarNode[]
	{
		const nodes: ISidebarNode[] = [];
		this.PushArea(nodes, "System", this.system_, "시스템");
		this.PushArea(nodes, "External", this.external_, "외부 플러그인");
		return nodes;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 한 영역의 노드를 만들어 붙인다. 정렬기준은 그룹 안 나열에만 적용하고 그룹 순서는 건드리지 않는다.
	// 검색 중이면 숨김 그룹을 통째로 빼고, 매칭이 없는 그룹·영역 헤더도 내린다.
	// @param _nodes: 결과 배열
	// @param _area: 영역
	// @param _items: 그 영역의 항목
	// @param _title: 영역 제목
	private PushArea(_nodes: ISidebarNode[], _area: TPluginGroupArea, _items: ISidebarItem[], _title: string): void
	{
		const groups = this.groups_[_area];
		if (_items.length === 0 && !groups.some((_group) => _group.Kind === "User"))
			return;
		const searching = this.filter_.length > 0;
		const sort: TSidebarSort = _area === "External" ? PluginOrder.NormalizeSort(this.sortMode_) : "Custom";
		const suffix = sort === "Custom" ? "" : ` · ${PluginOrder.SortLabel(sort)}`;
		const draggable = sort === "Custom" && this.orderChanged_ !== null && !searching;
		const entries: IOrderEntryItem[] = _items.map((_item) => ({ ..._item, Name: _item.Title }));
		const body: ISidebarNode[] = [];
		for (const group of groups)
		{
			if (searching && PluginGroups.IsHiddenGroup(group.Id))
				continue;
			const ordered = PluginGroups.OrderWithin(group, entries, sort, this.clicks_, this.seen_).filter((_item) => this.MatchFilter(_item));
			if (searching && ordered.length === 0)
				continue;
			const collapsed = !searching && group.Collapsed;
			body.push(SidebarController.GroupNode(_area, group, collapsed));
			if (collapsed)
				continue;
			for (const item of ordered)
				body.push(SidebarController.ItemNode(_area, group.Id, item, draggable));
		}
		if (searching && body.length === 0)
			return;
		const areaCollapsed = !searching && this.areaCollapsed_[_area];
		_nodes.push(SidebarController.AreaNode(_area, `${_title}${suffix}`, areaCollapsed));
		if (areaCollapsed)
			return;
		_nodes.push(...body);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 영역 헤더 노드를 만든다. 키는 기존 테스트 이름을 그대로 쓴다.
	// @param _area: 영역
	// @param _text: 제목
	// @param _collapsed: 접힘 여부
	private static AreaNode(_area: TPluginGroupArea, _text: string, _collapsed: boolean): ISidebarNode
	{
		return { Kind: "Header", Key: SidebarController.AreaKey(_area), Text: _text, Depth: 0, Area: _area, GroupId: "", Collapsed: _collapsed, CanRename: false, Item: null, Draggable: false };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 헤더 노드를 만든다. 키에 영역을 접두로 붙인다. 같은 group-1이 두 영역에 동시에 있을 수 있다.
	// @param _area: 영역
	// @param _group: 그룹
	// @param _collapsed: 접힘 여부
	private static GroupNode(_area: TPluginGroupArea, _group: IPluginGroup, _collapsed: boolean): ISidebarNode
	{
		return { Kind: "Group", Key: `${_area}/${_group.Id}`, Text: _group.Name, Depth: 1, Area: _area, GroupId: _group.Id, Collapsed: _collapsed, CanRename: !PluginGroups.IsFixedGroup(_group.Id), Item: null, Draggable: false };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 노드를 만든다. 항목 키는 Plugin Id다. 그룹을 옮겨도 같은 버튼을 재사용한다.
	// @param _area: 영역
	// @param _groupId: 속한 그룹 Id
	// @param _item: 항목
	// @param _draggable: 드래그 허용 여부
	private static ItemNode(_area: TPluginGroupArea, _groupId: string, _item: ISidebarItem, _draggable: boolean): ISidebarNode
	{
		return { Kind: "Item", Key: _item.Id, Text: _item.Title, Depth: 2, Area: _area, GroupId: _groupId, Collapsed: false, CanRename: false, Item: _item, Draggable: _draggable };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 영역 헤더 키를 구한다.
	// @param _area: 영역
	private static AreaKey(_area: TPluginGroupArea): string
	{
		return _area === "System" ? "sidebar_header_system" : "sidebar_header_external";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사라진 헤더·항목만 정리한다. 하나라도 버렸으면 true.
	// @param _itemKeys: 남길 항목 Id
	// @param _headerKeys: 남길 헤더 키
	private Prune(_itemKeys: ReadonlySet<string>, _headerKeys: ReadonlySet<string>): boolean
	{
		let changed = false;
		for (const [key, header] of [...this.headers_])
		{
			if (_headerKeys.has(key))
				continue;
			this.list_.RemoveChild(header, true);
			this.headers_.delete(key);
			changed = true;
		}
		for (const [id, view] of [...this.items_])
		{
			if (_itemKeys.has(id))
				continue;
			this.list_.RemoveChild(view.Button, true);
			this.items_.delete(id);
			changed = true;
		}
		return changed;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더 컨트롤을 구한다. 없으면 만들고 바뀐 값만 갱신한다.
	// @param _node: 헤더 노드
	private RealizeHeader(_node: ISidebarNode): SidebarGroupHeader
	{
		let header = this.headers_.get(_node.Key);
		if (header === undefined)
		{
			header = this.CreateHeader(_node);
			this.headers_.set(_node.Key, header);
		}
		header.Title = _node.Text;
		header.Depth = _node.Depth;
		header.IsCollapsed = _node.Collapsed;
		header.CanRename = _node.CanRename;
		return header;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더를 새로 만들고 접기·이름 변경·우클릭 메뉴를 건다. 리스너는 여기서 한 번만 건다.
	// @param _node: 헤더 노드
	private CreateHeader(_node: ISidebarNode): SidebarGroupHeader
	{
		const header = new SidebarGroupHeader();
		const area = _node.Area;
		const groupId = _node.GroupId;
		header.Name = groupId.length === 0 ? _node.Key : `group_${area}_${groupId}`;
		header.Element.classList.add(groupId.length === 0 ? "is-area" : "is-group");
		header.Toggled.Add((_collapsed) => { this.OnHeaderToggled(area, groupId, _collapsed); });
		header.Renamed.Add((_name) => { this.OnHeaderRenamed(area, groupId, _name); });
		header.ContextMenu = groupId.length === 0 ? this.AreaMenu(area) : this.GroupMenu(area, groupId);
		return header;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 버튼을 구한다. 없으면 만들고, 있으면 바뀐 속성만 갱신한다.
	// @param _item: 항목
	// @param _depth: 들여쓰기 단계
	private RealizeItem(_item: ISidebarItem, _depth: number): IItemView
	{
		let view = this.items_.get(_item.Id);
		if (view === undefined)
		{
			view = this.CreateItem(_item.Id);
			this.items_.set(_item.Id, view);
		}
		const element = view.Button.Element;
		if (view.Title !== _item.Title)
		{
			view.Button.Content = _item.Title;
			view.Title = _item.Title;
			SidebarController.ClearNoticeMarks(view);	// 콘텐츠 교체로 텍스트가 뒤에 붙으므로 표시를 다시 만든다.
		}
		if (view.Depth !== _depth)
		{
			view.Depth = _depth;
			element.style.setProperty("--gui-nav-depth", String(_depth));
		}
		view.Button.Icon = _item.Icon;
		element.classList.toggle("is-core", _item.Source === "BuiltIn");
		element.classList.toggle("is-external", _item.Source !== "BuiltIn");
		element.classList.toggle("is-error", _item.State === "Error");
		SidebarController.ApplyNotice(view, _item.Id);
		return view;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 버튼을 새로 만들고 클릭·메뉴·드래그 시작점을 건다. 리스너는 여기서 한 번만 건다.
	// @param _id: Plugin Id
	private CreateItem(_id: string): IItemView
	{
		const btn = new ToggleButton();
		btn.Name = `nav_${_id}`;
		btn.Variant = "Ghost";
		btn.Element.classList.add("gui-navitem");
		btn.ContextMenu = this.ItemMenu(_id);
		btn.Click.Add((_s, _a) =>
		{
			this.shell_.Navigate(_id);
		});
		const view: IItemView = { Button: btn, Title: "", Notice: null, Draggable: false, Depth: -1 };
		btn.Element.addEventListener("pointerdown", (_e) =>
		{
			if (_e.button !== 0 || !view.Draggable)
				return;
			this.OnPress(_id, _e);
		});
		return view;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 드래그 허용 여부를 바꾼다. 라우트 이벤트가 아니라 DOM 직접이라 손잡이만 토글한다.
	// @param _view: 항목 뷰
	// @param _draggable: 드래그 허용 여부
	private static ApplyDraggable(_view: IItemView, _draggable: boolean): void
	{
		_view.Draggable = _draggable;
		_view.Button.Element.style.cursor = _draggable ? "grab" : "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 필터에 걸리는지 본다.
	// @param _item: 항목
	private MatchFilter(_item: ISidebarItem): boolean
	{
		if (this.filter_.length === 0)
			return true;
		return _item.Title.toLowerCase().includes(this.filter_) || _item.Id.toLowerCase().includes(this.filter_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목이 속한 영역을 구한다. 목록에 없으면 null.
	// @param _itemId: Plugin Id
	private AreaOfItem(_itemId: string): TPluginGroupArea | null
	{
		if (this.system_.some((_item) => _item.Id === _itemId))
			return "System";
		if (this.external_.some((_item) => _item.Id === _itemId))
			return "External";
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목이 속한 그룹 Id를 구한다. 없으면 빈 문자열.
	// @param _area: 영역
	// @param _itemId: Plugin Id
	private GroupIdOf(_area: TPluginGroupArea, _itemId: string): string
	{
		return this.groups_[_area].find((_group) => _group.Items.includes(_itemId))?.Id ?? "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 이동을 적용하고 콜백까지 간다. 거부되면 false.
	// @param _area: 영역
	// @param _itemId: Plugin Id
	// @param _groupId: 대상 그룹 Id
	// @param _index: 대상 그룹에서 제거 후 기준 삽입 위치
	private ApplyItemMove(_area: TPluginGroupArea, _itemId: string, _groupId: string, _index: number): boolean
	{
		const next = PluginGroups.MoveItem(this.groups_, _area, _itemId, _groupId, _index);
		if (next === this.groups_)
			return false;
		this.groups_ = next;
		const at = PluginGroups.FindGroup(next, _area, _groupId)?.Items.indexOf(_itemId) ?? 0;
		this.Reconcile();
		if (this.orderChanged_ !== null)
			this.orderChanged_(_area, _itemId, _groupId, at);
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더 접힘을 반영한다. 영역 헤더와 그룹 헤더는 저장 위치가 다르다.
	// @param _area: 영역
	// @param _groupId: 그룹 Id (빈 문자열이면 영역 헤더)
	// @param _collapsed: 접을지 여부
	private OnHeaderToggled(_area: TPluginGroupArea, _groupId: string, _collapsed: boolean): void
	{
		if (_groupId.length === 0)
		{
			this.SetAreaCollapsed(_area, _collapsed);
			return;
		}
		const next = PluginGroups.SetCollapsed(this.groups_, _area, _groupId, _collapsed);
		if (next === this.groups_)
			return;
		this.groups_ = next;
		this.Reconcile();
		if (this.groupsChanged_ !== null)
			this.groupsChanged_(next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 영역 접힘을 반영한다.
	// @param _area: 영역
	// @param _collapsed: 접을지 여부
	private SetAreaCollapsed(_area: TPluginGroupArea, _collapsed: boolean): void
	{
		if (this.areaCollapsed_[_area] === _collapsed)
			return;
		const next: Record<TPluginGroupArea, boolean> = { System: this.areaCollapsed_.System, External: this.areaCollapsed_.External };
		next[_area] = _collapsed;
		this.areaCollapsed_ = next;
		this.Reconcile();
		if (this.areaCollapsedChanged_ !== null)
			this.areaCollapsedChanged_(_area, _collapsed);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 이름 변경을 반영한다. 고정 그룹·빈 이름은 PluginGroups가 거부한다.
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	// @param _name: 새 이름
	private OnHeaderRenamed(_area: TPluginGroupArea, _groupId: string, _name: string): void
	{
		const next = PluginGroups.RenameGroup(this.groups_, _area, _groupId, _name);
		if (next === this.groups_)
			return;
		this.groups_ = next;
		this.Reconcile();
		if (this.groupsChanged_ !== null)
			this.groupsChanged_(next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 영역 헤더 메뉴. 서브 그룹을 만들고 바로 이름 편집으로 들어간다.
	// @param _area: 영역
	private AreaMenu(_area: TPluginGroupArea): ContextMenu
	{
		const menu = new ContextMenu();
		const add = new MenuItem();
		add.Name = `group_add_${_area}`;
		add.Header = "서브 그룹 추가";
		add.Click.Add(() => { this.AddGroupAndEdit(_area); });
		menu.AddItem(add);
		return menu;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 헤더 메뉴. 고정 그룹은 이름 변경·삭제를 빼고 순서 이동만 남긴다.
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	private GroupMenu(_area: TPluginGroupArea, _groupId: string): ContextMenu
	{
		const menu = new ContextMenu();
		if (!PluginGroups.IsFixedGroup(_groupId))
		{
			const rename = new MenuItem();
			rename.Name = `group_rename_${_area}_${_groupId}`;
			rename.Header = "이름 변경";
			rename.InputGestureText = "F2";
			rename.Click.Add(() => { this.BeginRename(_area, _groupId); });
			menu.AddItem(rename);
			const remove = new MenuItem();
			remove.Name = `group_remove_${_area}_${_groupId}`;
			remove.Header = "삭제";
			remove.Click.Add(() => { this.RemoveGroup(_area, _groupId); });
			menu.AddItem(remove);
		}
		const up = new MenuItem();
		up.Name = `group_up_${_area}_${_groupId}`;
		up.Header = "위로 이동";
		up.Click.Add(() => { this.MoveGroupBy(_area, _groupId, -1); });
		menu.AddItem(up);
		const down = new MenuItem();
		down.Name = `group_down_${_area}_${_groupId}`;
		down.Header = "아래로 이동";
		down.Click.Add(() => { this.MoveGroupBy(_area, _groupId, 1); });
		menu.AddItem(down);
		return menu;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 메뉴. 다시 로드 + 그룹으로 이동 서브메뉴다.
	// 서브 항목은 프레임워크가 ▸ 표시를 그리게 하는 용도고, 실제 목록은 누를 때 현재 그룹으로 다시 만든다.
	// @param _id: Plugin Id
	private ItemMenu(_id: string): ContextMenu
	{
		const menu = new ContextMenu();
		const reload = new MenuItem();
		reload.Name = `reload_${_id}`;
		reload.Header = "다시 로드";
		reload.Click.Add(() =>
		{
			void SidebarController.ReloadAndToast(_id);
		});
		menu.AddItem(reload);
		const move = new MenuItem();
		move.Name = `movegroup_${_id}`;
		move.Header = "그룹으로 이동";
		move.AddItem(new MenuItem());
		move.Click.Add(() => { this.OpenMoveSubmenu(_id, move); });
		menu.AddItem(move);
		return menu;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹으로 이동 서브메뉴를 연다. 같은 영역의 그룹만 나열한다.
	// @param _id: Plugin Id
	// @param _anchor: 부모 메뉴 항목
	private OpenMoveSubmenu(_id: string, _anchor: MenuItem): void
	{
		const area = this.AreaOfItem(_id);
		if (area === null)
			return;
		const current = this.GroupIdOf(area, _id);
		const entries: MenuItem[] = [];
		for (const group of this.groups_[area])
		{
			const entry = new MenuItem();
			entry.Name = `moveto_${_id}_${group.Id}`;
			entry.Header = group.Id === current ? `${group.Name} (현재)` : group.Name;
			entry.Click.Add(() => { this.MoveItemToGroup(area, _id, group.Id); });
			entries.push(entry);
		}
		const rect = _anchor.Element.getBoundingClientRect();
		this.moveMenu_?.Close();
		const submenu = new ContextMenu();
		this.moveMenu_ = submenu;	// 열려 있는 동안 수거되지 않게 참조를 들고 있는다.
		submenu.OpenItems(entries, rect.right, rect.top);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 그룹 맨 뒤로 옮긴다. 메뉴에서 고른 경우다.
	// @param _area: 영역
	// @param _itemId: Plugin Id
	// @param _groupId: 대상 그룹 Id
	private MoveItemToGroup(_area: TPluginGroupArea, _itemId: string, _groupId: string): void
	{
		this.ApplyItemMove(_area, _itemId, _groupId, Number.MAX_SAFE_INTEGER);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 새 그룹을 만들고 곧바로 이름 편집으로 들어간다. 접힌 영역이면 먼저 펼친다.
	// @param _area: 영역
	private AddGroupAndEdit(_area: TPluginGroupArea): void
	{
		const before = new Set(this.groups_[_area].map((_group) => _group.Id));
		const next = PluginGroups.AddGroup(this.groups_, _area, SidebarController.s_newGroupName_);
		if (next === this.groups_)
			return;
		this.groups_ = next;
		this.SetAreaCollapsed(_area, false);
		this.Reconcile();
		if (this.groupsChanged_ !== null)
			this.groupsChanged_(next);
		const added = this.groups_[_area].find((_group) => !before.has(_group.Id));
		if (added === undefined)
			return;
		this.BeginRename(_area, added.Id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 헤더를 이름 편집 상태로 만든다.
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	private BeginRename(_area: TPluginGroupArea, _groupId: string): void
	{
		const header = this.headers_.get(`${_area}/${_groupId}`);
		if (header === undefined)
			return;
		header.Focus();
		header.BeginEdit();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용자 그룹을 지운다. 안에 있던 항목은 PluginGroups가 같은 영역 기본 그룹으로 회수한다.
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	private RemoveGroup(_area: TPluginGroupArea, _groupId: string): void
	{
		const next = PluginGroups.RemoveGroup(this.groups_, _area, _groupId);
		if (next === this.groups_)
			return;
		this.groups_ = next;
		this.Reconcile();
		if (this.groupsChanged_ !== null)
			this.groupsChanged_(next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹을 위·아래로 한 칸 옮긴다. 고정 그룹도 옮길 수 있다.
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	// @param _delta: -1이면 위, 1이면 아래
	private MoveGroupBy(_area: TPluginGroupArea, _groupId: string, _delta: number): void
	{
		const groups = this.groups_[_area];
		const at = groups.findIndex((_group) => _group.Id === _groupId);
		const to = at + _delta;
		if (at < 0 || to < 0 || to >= groups.length)
			return;
		const next = PluginGroups.MoveGroup(this.groups_, _area, _groupId, to);
		if (next === this.groups_)
			return;
		this.groups_ = next;
		this.Reconcile();
		if (this.groupsChanged_ !== null)
			this.groupsChanged_(next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 눌림을 기록하고 창 단위 이동·뗌을 건다. 드래그 범위는 누른 항목이 속한 영역으로 가둔다.
	// @param _id: Plugin Id
	// @param _e: 포인터 이벤트
	private OnPress(_id: string, _e: PointerEvent): void
	{
		this.CancelDrag();
		const area = this.AreaOfItem(_id);
		if (area === null)
			return;
		this.drag_ = { Id: _id, Area: area, StartX: _e.clientX, StartY: _e.clientY, Active: false, Spot: null };
		this.onWindowMove_ = (_move) => { this.OnDragMove(_move); };
		this.onWindowUp_ = (_up) => { this.OnDragUp(); };
		window.addEventListener("pointermove", this.onWindowMove_);
		window.addEventListener("pointerup", this.onWindowUp_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 임계값을 넘기면 드래그로 굳히고 목표 표시를 갱신한다.
	// @param _e: 포인터 이벤트
	private OnDragMove(_e: PointerEvent): void
	{
		const drag = this.drag_;
		if (drag === null)
			return;
		if (!drag.Active)
		{
			const moved = Math.max(Math.abs(_e.clientX - drag.StartX), Math.abs(_e.clientY - drag.StartY));
			if (moved < 6)
				return;
			drag.Active = true;
			this.items_.get(drag.Id)?.Button.Element.classList.add("is-dragging");
		}
		_e.preventDefault();
		this.UpdateDropTarget(_e.clientX, _e.clientY);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 드래그를 확정한다. 드롭 지점이 잡혀 있으면 옮기고 저장 콜백까지 간다.
	// 이동은 Reconcile → CancelDrag로 이어지므로 드래그 상태를 먼저 버리고 적용한다.
	private OnDragUp(): void
	{
		const drag = this.drag_;
		this.DetachWindowDrag();
		this.ClearDropMarks();
		this.items_.get(drag?.Id ?? "")?.Button.Element.classList.remove("is-dragging");
		this.drag_ = null;
		if (drag !== null && drag.Active && drag.Spot !== null)
			this.Drop(drag.Id, drag.Spot);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 커서 아래 드롭 지점을 정하고 표시한다. 영역이 다르면 지점도 표시도 만들지 않는다.
	// 항목 사이는 선(is-drop-before·is-drop-after), 그룹 헤더는 면(is-drop-into)으로 구분해 보여 준다.
	// @param _x: 커서 X
	// @param _y: 커서 Y
	private UpdateDropTarget(_x: number, _y: number): void
	{
		const drag = this.drag_;
		if (drag === null)
			return;
		this.ClearDropMarks();
		drag.Spot = null;
		const hit = this.HitTest(_x, _y);
		if (hit === null || hit.Area !== drag.Area)
			return;
		if (hit.Kind === "Group")
		{
			drag.Spot = { Kind: "Group", Key: hit.Key, After: false };
			hit.Element.classList.add("is-drop-into");
			return;
		}
		if (hit.Key === drag.Id)
			return;
		const rect = hit.Element.getBoundingClientRect();
		const after = _y >= rect.top + rect.height / 2;
		drag.Spot = { Kind: "Item", Key: hit.Key, After: after };
		hit.Element.classList.add(after ? "is-drop-after" : "is-drop-before");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목표 표시를 지운다.
	private ClearDropMarks(): void
	{
		for (const marked of this.list_.Element.querySelectorAll(".is-drop-before,.is-drop-after,.is-drop-into"))
			marked.classList.remove("is-drop-before", "is-drop-after", "is-drop-into");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창 단위 드래그 리스너를 뗀다.
	private DetachWindowDrag(): void
	{
		if (this.onWindowMove_ !== null)
			window.removeEventListener("pointermove", this.onWindowMove_);
		if (this.onWindowUp_ !== null)
			window.removeEventListener("pointerup", this.onWindowUp_);
		this.onWindowMove_ = null;
		this.onWindowUp_ = null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 진행 중 드래그를 버린다. 목록 구성이 바뀐 경우에만 호출한다.
	// 버튼을 재사용하므로 표시 클래스도 직접 걷어낸다.
	private CancelDrag(): void
	{
		this.DetachWindowDrag();
		this.ClearDropMarks();
		const drag = this.drag_;
		if (drag !== null)
			this.items_.get(drag.Id)?.Button.Element.classList.remove("is-dragging");
		this.drag_ = null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 좌표 아래 드롭 후보를 구한다. 사이드바 목록 밖이거나 후보가 아니면 null.
	// 항목 버튼과 그룹 헤더 둘 다 잡는다. 헤더까지 잡아야 빈 그룹·접힌 그룹에 떨어뜨릴 수 있다.
	// 영역 헤더는 그룹이 아니므로 후보에서 뺀다.
	// @param _x: 커서 X
	// @param _y: 커서 Y
	private HitTest(_x: number, _y: number): IDropHit | null
	{
		if (typeof document.elementFromPoint !== "function")
			return null;
		const hit = document.elementFromPoint(_x, _y);
		if (hit === null || !this.list_.Element.contains(hit))
			return null;
		const nav = hit.closest("[data-testid^=\"nav_\"]");
		if (nav !== null)
		{
			const key = (nav.getAttribute("data-testid") ?? "").slice(4);
			const area = this.AreaOfItem(key);
			return area === null ? null : { Kind: "Item", Area: area, Key: key, Element: nav };
		}
		const header = hit.closest(".gui-navheader");
		return header === null ? null : this.GroupHitOf(header);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 헤더 요소를 그룹 드롭 후보로 바꾼다. 헤더 키는 "{영역}/{그룹Id}"이고 영역 헤더는 접두가 없다.
	// testid를 쪼개지 않고 실제로 그린 헤더 맵에서 찾는다. 그룹 Id에 무엇이 들어와도 안전해야 하기 때문이다.
	// @param _element: 헤더 요소
	private GroupHitOf(_element: Element): IDropHit | null
	{
		for (const [key, header] of this.headers_)
		{
			if (header.Element !== _element)
				continue;
			const area: TPluginGroupArea | null = key.startsWith("System/") ? "System" : (key.startsWith("External/") ? "External" : null);
			if (area === null)
				return null;
			return { Kind: "Group", Area: area, Key: key.slice(area.length + 1), Element: _element };
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 다시 로드하고 결과를 인앱 토스트로 알린다.
	// @param _id: Plugin Id
	private static async ReloadAndToast(_id: string): Promise<void>
	{
		await PluginManager.ReloadAsync(_id);
		const name = PluginManager.Get(_id)?.Manifest.Name ?? _id;
		if (PluginManager.Get(_id)?.State === "Active")
			ToastService.Success(`${name} 다시 로드 완료`);
		else
			ToastService.Error(`${name} 다시 로드 실패`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시(dot·느낌표)를 맞춘다. 표시 종류가 그대로면 DOM은 건드리지 않는다.
	// 캐시가 실제 DOM과 어긋나면(밖에서 스팬이 지워졌다면) 캐시를 믿지 않고 다시 만든다.
	// @param _view: 항목 뷰
	// @param _id: Plugin Id
	private static ApplyNotice(_view: IItemView, _id: string): void
	{
		const notice = PluginManager.NoticeOf(_id);
		const marked = _view.Button.Element.querySelector(".gui-navitem__dot,.gui-navitem__alert") !== null;
		if (_view.Notice !== notice || marked !== (notice !== null))
		{
			SidebarController.ClearNoticeMarks(_view);
			if (notice === "Dirty")
			{
				const dot = document.createElement("span");
				dot.className = "gui-navitem__dot";
				_view.Button.Element.append(dot);
			}
			else if (notice === "Error")
			{
				const alert = document.createElement("span");
				alert.className = "gui-navitem__alert";
				alert.textContent = "!";
				_view.Button.Element.append(alert);
			}
			_view.Notice = notice;
		}
		_view.Button.ToolTip = SidebarController.TooltipOf(_view.Title, notice);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시 스팬을 걷어낸다. 다음 ApplyNotice가 다시 만든다.
	// @param _view: 항목 뷰
	private static ClearNoticeMarks(_view: IItemView): void
	{
		for (const old of [..._view.Button.Element.querySelectorAll(".gui-navitem__dot,.gui-navitem__alert")])
			old.remove();
		_view.Notice = null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시에 맞는 툴팁 문구를 구한다.
	// @param _title: 기본 제목
	// @param _notice: 표시
	private static TooltipOf(_title: string, _notice: PluginNotice | null): string
	{
		if (_notice === "Dirty")
			return `${_title} (다시 로드 필요)`;
		if (_notice === "Error")
			return `${_title} (로드 실패)`;
		return _title;
	}
}
