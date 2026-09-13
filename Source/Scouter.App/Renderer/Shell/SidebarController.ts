/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SidebarController. Plugin 목록을 ToggleButton으로 그린다. 시스템·외부 영역 분리 + 외부 드래그 정렬.
*/

import { StackPanel, ToggleButton, ContextMenu, MenuItem, TextBlock, ToastService, UIElement } from "@scouter/gui";
import type { PluginSource, PluginState } from "../Plugin/PluginManager";
import { PluginManager } from "../Plugin/PluginManager";
import { PluginOrder } from "../Plugin/PluginOrder";
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
	OnOrderChanged?: (_ids: string[]) => void;
}

interface IDragState
{
	Id: string;
	StartX: number;
	StartY: number;
	Active: boolean;
	TargetId: string | null;
	After: boolean;
}

export class SidebarController
{
	// ==================== 멤버 ====================
	private readonly list_: StackPanel;
	private readonly shell_: ShellWindow;
	private readonly items_ = new Map<string, ToggleButton>();
	private system_: ISidebarItem[] = [];
	private external_: ISidebarItem[] = [];
	private filter_ = "";
	private sortMode_ = "Custom";
	private orderChanged_: ((_ids: string[]) => void) | null = null;
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
	// 항목을 다시 그린다. 시스템은 위, 외부는 아래 영역으로 나눈다.
	// @param _items: 항목 목록
	// @param _opts: 정렬모드·순서 콜백
	public Rebuild(_items: ISidebarItem[], _opts?: ISidebarOptions): void
	{
		this.CancelDrag();
		this.system_ = _items.filter((_item) => _item.Source === "BuiltIn");
		this.external_ = _items.filter((_item) => _item.Source !== "BuiltIn");
		this.sortMode_ = _opts?.SortMode ?? "Custom";
		this.orderChanged_ = _opts?.OnOrderChanged ?? null;
		this.RenderFiltered();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 제목·Id 부분 일치로 목록을 줄인다. 빈 문자열이면 전부 보인다.
	// @param _text: 검색어
	public Filter(_text: string): void
	{
		const query = _text.toLowerCase();
		if (query === this.filter_)
			return;
		this.CancelDrag();
		this.filter_ = query;
		this.RenderFiltered();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택을 하나만 남긴다.
	// @param _pluginId: 선택 Id
	public Select(_pluginId: string): void
	{
		for (const [id, btn] of this.items_)
			btn.IsChecked = id === _pluginId;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 항목에 포커스를 준다. 재시작 복원용.
	// @param _pluginId: 포커스 Id
	public Focus(_pluginId: string): boolean
	{
		const btn = this.items_.get(_pluginId);
		if (btn === undefined)
			return false;
		return btn.Focus();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 배지를 단다. P6에서 사용.
	// @param _pluginId: 항목 Id
	// @param _text: 배지 문구
	public SetBadge(_pluginId: string, _text: string): void
	{
		const btn = this.items_.get(_pluginId);
		if (btn !== undefined)
			btn.ToolTip = `${_pluginId} (${_text})`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 외부 영역 Id를 표시 순서대로 구한다. 테스트·저장용.
	public ExternalIds(): string[]
	{
		return this.external_.map((_item) => _item.Id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 드래그를 목표 앞으로/뒤로 옮긴다. 바뀌었으면 true + 순서 콜백.
	// @param _dragId: 끄는 Id
	// @param _targetId: 목표 Id
	// @param _after: 목표 뒤이면 true
	public MoveBefore(_dragId: string, _targetId: string, _after: boolean): boolean
	{
		if (_dragId === _targetId)
			return false;
		const from = this.external_.findIndex((_item) => _item.Id === _dragId);
		const at = this.external_.findIndex((_item) => _item.Id === _targetId);
		if (from < 0 || at < 0)
			return false;
		const [moving] = this.external_.splice(from, 1);
		if (moving === undefined)
			return false;
		let to = this.external_.findIndex((_item) => _item.Id === _targetId);
		if (_after)
			to += 1;
		this.external_.splice(to, 0, moving);
		this.RenderFiltered();
		if (this.orderChanged_ !== null)
			this.orderChanged_(this.ExternalIds());
		return true;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 보관 목록을 영역별로 그린다. 필터 중이거나 정렬기준 모드면 드래그를 끈다.
	private RenderFiltered(): void
	{
		this.list_.ClearChildren();
		this.items_.clear();
		const system = this.system_.filter((_item) => this.MatchFilter(_item));
		const external = this.external_.filter((_item) => this.MatchFilter(_item));
		if (system.length > 0)
		{
			this.AddHeader("sidebar_header_system", "시스템");
			for (const item of system)
				this.AddButton(item, false);
		}
		if (external.length > 0)
		{
			const sort = PluginOrder.NormalizeSort(this.sortMode_);
			const suffix = sort === "Custom" ? "" : ` · ${PluginOrder.SortLabel(sort)}`;
			this.AddHeader("sidebar_header_external", `외부 플러그인${suffix}`);
			const draggable = sort === "Custom" && this.orderChanged_ !== null && this.filter_.length === 0;
			for (const item of external)
				this.AddButton(item, draggable);
		}
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
	// 영역 제목을 단다.
	// @param _name: 테스트 이름
	// @param _text: 제목
	private AddHeader(_name: string, _text: string): void
	{
		const header = new TextBlock();
		header.Name = _name;
		header.Text = _text;
		header.Element.classList.add("gui-navheader");
		this.list_.AddChild(header);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 버튼을 달고 클릭·메뉴·드래그를 건다.
	// @param _item: 항목
	// @param _draggable: 드래그 허용 여부
	private AddButton(_item: ISidebarItem, _draggable: boolean): void
	{
		const btn = new ToggleButton();
		btn.Name = `nav_${_item.Id}`;
		btn.Content = _item.Title;
		btn.Icon = _item.Icon;
		btn.Variant = "Ghost";
		btn.ToolTip = _item.Title;
		btn.Element.classList.add("gui-navitem");
		btn.Element.classList.toggle("is-core", _item.Source === "BuiltIn");
		btn.Element.classList.toggle("is-external", _item.Source !== "BuiltIn");
		btn.Element.classList.toggle("is-error", _item.State === "Error");
		const id = _item.Id;
		btn.Click.Add((_s, _a) =>
		{
			this.shell_.Navigate(id);
		});
		btn.ContextMenu = SidebarController.ReloadMenu(id);
		if (_draggable)
			SidebarController.ArmDrag(btn, (_e) => { this.OnPress(id, _e); });
		this.list_.AddChild(btn);
		this.items_.set(_item.Id, btn);
		this.RefreshNotice(btn, _item.Id, _item.Title);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 버튼에 포인터 드래그 시작점을 건다. 라우트 이벤트가 아니라 DOM 직접이다.
	// @param _btn: 버튼
	// @param _press: 눌림 콜백
	private static ArmDrag(_btn: ToggleButton, _press: (_e: PointerEvent) => void): void
	{
		_btn.Element.style.cursor = "grab";
		_btn.Element.addEventListener("pointerdown", (_e) =>
		{
			if (_e.button !== 0)
				return;
			_press(_e);
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 눌림을 기록하고 창 단위 이동·뗌을 건다.
	// @param _id: Plugin Id
	// @param _e: 포인터 이벤트
	private OnPress(_id: string, _e: PointerEvent): void
	{
		this.CancelDrag();
		this.drag_ = { Id: _id, StartX: _e.clientX, StartY: _e.clientY, Active: false, TargetId: null, After: false };
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
			this.items_.get(drag.Id)?.Element.classList.add("is-dragging");
		}
		_e.preventDefault();
		this.UpdateDropTarget(_e.clientX, _e.clientY);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 드래그를 확정한다. 순서가 바뀌면 저장 콜백까지 간다.
	private OnDragUp(): void
	{
		const drag = this.drag_;
		this.DetachWindowDrag();
		this.ClearDropMarks();
		this.items_.get(drag?.Id ?? "")?.Element.classList.remove("is-dragging");
		if (drag !== null && drag.Active && drag.TargetId !== null)
			this.MoveBefore(drag.Id, drag.TargetId, drag.After);
		this.drag_ = null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 커서 아래 외부 버튼을 목표 표시한다.
	// @param _x: 커서 X
	// @param _y: 커서 Y
	private UpdateDropTarget(_x: number, _y: number): void
	{
		const drag = this.drag_;
		if (drag === null)
			return;
		this.ClearDropMarks();
		drag.TargetId = null;
		const found = SidebarController.NavIdAt(_x, _y);
		if (found === null || found === drag.Id)
			return;
		const btn = this.items_.get(found);
		if (btn === undefined || !btn.Element.classList.contains("is-external"))
			return;
		const rect = btn.Element.getBoundingClientRect();
		drag.TargetId = found;
		drag.After = _y >= rect.top + rect.height / 2;
		btn.Element.classList.add(drag.After ? "is-drop-after" : "is-drop-before");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목표 표시를 지운다.
	private ClearDropMarks(): void
	{
		for (const marked of this.list_.Element.querySelectorAll(".is-drop-before,.is-drop-after"))
			marked.classList.remove("is-drop-before", "is-drop-after");
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
	// 진행 중 드래그를 버린다. 다시 그리기·필터 전에 호출.
	private CancelDrag(): void
	{
		this.DetachWindowDrag();
		this.drag_ = null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 좌표 아래 nav 버튼 Id를 구한다. 없으면 null.
	// @param _x: 커서 X
	// @param _y: 커서 Y
	private static NavIdAt(_x: number, _y: number): string | null
	{
		if (typeof document.elementFromPoint !== "function")
			return null;
		const hit = document.elementFromPoint(_x, _y);
		const nav = hit?.closest("[data-testid^=\"nav_\"]") ?? null;
		if (nav === null)
			return null;
		const testId = nav.getAttribute("data-testid") ?? "";
		return testId.startsWith("nav_") ? testId.slice(4) : null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 다시 로드 메뉴를 만든다. E2E에서 이름으로 누른다.
	// @param _id: Plugin Id
	private static ReloadMenu(_id: string): ContextMenu
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
		return menu;
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
	// 표시(dot·느낌표)를 붙인다. Changed로 다시 그려질 때도 유지된다.
	// @param _btn: 사이드바 버튼
	// @param _id: Plugin Id
	// @param _title: 기본 툴팁
	private RefreshNotice(_btn: ToggleButton, _id: string, _title: string): void
	{
		for (const old of [..._btn.Element.querySelectorAll(".gui-navitem__dot,.gui-navitem__alert")])
			old.remove();
		const notice = PluginManager.NoticeOf(_id);
		if (notice === null)
		{
			_btn.ToolTip = _title;
			return;
		}
		if (notice === "Dirty")
		{
			const dot = document.createElement("span");
			dot.className = "gui-navitem__dot";
			_btn.Element.append(dot);
			_btn.ToolTip = `${_title} (다시 로드 필요)`;
			return;
		}
		const alert = document.createElement("span");
		alert.className = "gui-navitem__alert";
		alert.textContent = "!";
		_btn.Element.append(alert);
		_btn.ToolTip = `${_title} (로드 실패)`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 요소를 구한다. 테스트용.
	// @param _pluginId: 항목 Id
	public Find(_pluginId: string): UIElement | null
	{
		return this.items_.get(_pluginId) ?? null;
	}
}
