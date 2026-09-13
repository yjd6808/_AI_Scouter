/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SidebarController. Plugin 목록을 ToggleButton으로 그린다.
*/

import { StackPanel, ToggleButton, ContextMenu, MenuItem, UIElement } from "@scouter/gui";
import type { PluginSource, PluginState } from "../Plugin/PluginManager";
import { PluginManager } from "../Plugin/PluginManager";
import type { ShellWindow } from "./ShellWindow";

export interface ISidebarItem
{
	Id: string;
	Title: string;
	Icon: string;
	Source: PluginSource;
	State: PluginState;
}

export class SidebarController
{
	// ==================== 멤버 ====================
	private readonly list_: StackPanel;
	private readonly shell_: ShellWindow;
	private readonly items_ = new Map<string, ToggleButton>();
	private all_: ISidebarItem[] = [];
	private filter_ = "";

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
	// 항목을 다시 그린다. 보관 뒤 필터를 적용한다.
	// @param _items: 항목 목록
	public Rebuild(_items: ISidebarItem[]): void
	{
		this.all_ = [..._items];
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

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 보관 목록에 필터를 걸어 버튼을 다시 그린다.
	private RenderFiltered(): void
	{
		this.list_.ClearChildren();
		this.items_.clear();
		for (const item of this.all_)
		{
			if (this.filter_.length > 0
				&& !item.Title.toLowerCase().includes(this.filter_)
				&& !item.Id.toLowerCase().includes(this.filter_))
				continue;
			const btn = new ToggleButton();
			btn.Name = `nav_${item.Id}`;
			btn.Content = item.Title;
			btn.Icon = item.Icon;
			btn.Variant = "Ghost";
			btn.ToolTip = item.Title;
			btn.Element.classList.add("gui-navitem");
			btn.Element.classList.toggle("is-core", item.Source === "BuiltIn");
			btn.Element.classList.toggle("is-external", item.Source !== "BuiltIn");
			btn.Element.classList.toggle("is-error", item.State === "Error");
			const id = item.Id;
			btn.Click.Add((_s, _a) =>
			{
				this.shell_.Navigate(id);
			});
			btn.ContextMenu = SidebarController.ReloadMenu(id);
			this.list_.AddChild(btn);
			this.items_.set(item.Id, btn);
			this.RefreshNotice(btn, item.Id, item.Title);
		}
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
			void PluginManager.ReloadAsync(_id);
		});
		menu.AddItem(reload);
		return menu;
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
