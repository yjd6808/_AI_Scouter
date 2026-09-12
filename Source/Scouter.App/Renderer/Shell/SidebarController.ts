/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SidebarController. Plugin 목록을 ToggleButton으로 그린다.
*/

import { StackPanel, ToggleButton, UIElement } from "@scouter/gui";
import type { ShellWindow } from "./ShellWindow";

export interface ISidebarItem
{
	Id: string;
	Title: string;
	Icon: string;
}

export class SidebarController
{
	// ==================== 멤버 ====================
	private readonly list_: StackPanel;
	private readonly shell_: ShellWindow;
	private readonly items_ = new Map<string, ToggleButton>();

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
	// 항목을 다시 그린다.
	// @param _items: 항목 목록
	public Rebuild(_items: ISidebarItem[]): void
	{
		this.list_.ClearChildren();
		this.items_.clear();
		for (const item of _items)
		{
			const btn = new ToggleButton();
			btn.Name = `nav_${item.Id}`;
			btn.Content = item.Title;
			btn.Icon = item.Icon;
			btn.Variant = "Ghost";
			btn.ToolTip = item.Title;
			btn.Element.classList.add("gui-navitem");
			const id = item.Id;
			btn.Click.Add((_s, _a) =>
			{
				this.shell_.Navigate(id);
			});
			this.list_.AddChild(btn);
			this.items_.set(item.Id, btn);
		}
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
	// 항목 요소를 구한다. 테스트용.
	// @param _pluginId: 항목 Id
	public Find(_pluginId: string): UIElement | null
	{
		return this.items_.get(_pluginId) ?? null;
	}
}
