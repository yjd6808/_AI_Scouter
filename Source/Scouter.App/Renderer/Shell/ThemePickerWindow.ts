/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 테마 피커. 선택마다 미리보기, 적용/취소. 스킴 즉시 적용.
*/

import { Window, ListBox, Button, ComboBox, TextBox, DataList, RegisterWindow } from "@scouter/gui";
import type { ThemeMode } from "@scouter/gui";
import { ThemeManager } from "../Theme/ThemeManager";
import { Settings } from "../Services/Settings";

@RegisterWindow("ThemePicker")
export class ThemePickerWindow extends Window
{
	// ==================== 멤버 ====================
	private original_ = "oc-2";
	private originalScheme_: ThemeMode = "System";
	private list_!: ListBox;

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록을 채우고 미리보기를 건다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.original_ = Settings.Get<string>("Theme.Id", "oc-2");
		this.originalScheme_ = Settings.Get<ThemeMode>("Theme.Scheme", "System");
		const scheme = this.RequireName(ComboBox, "cmb_scheme");
		scheme.SetItems(["System", "Dark", "Light"]);
		scheme.SelectedItem = this.originalScheme_;
		scheme.SelectionChanged.Add(() =>
		{
			const item = scheme.SelectedItem;
			if (typeof item === "string")
				Settings.Set("Theme.Scheme", item);
		});
		this.list_ = this.RequireName(ListBox, "lst_themes");
		this.RefreshList("");
		this.list_.SelectionChanged.Add(() =>
		{
			const item = this.list_.SelectedItem;
			if (typeof item === "string")
				ThemeManager.Set(item);
		});
		const filter = this.FindName(TextBox, "txt_filter");
		filter?.TextChanged.Add(() =>
		{
			this.RefreshList(filter.Text);
		});
		this.FindName(Button, "btn_apply")?.Click.Add(() =>
		{
			const item = this.list_.SelectedItem;
			if (typeof item === "string")
				Settings.Set("Theme.Id", item);
			this.Close(true);
		});
		this.FindName(Button, "btn_cancel")?.Click.Add(() =>
		{
			ThemeManager.Set(this.original_);
			Settings.Set("Theme.Scheme", this.originalScheme_);
			this.Close(false);
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 필터로 목록을 다시 깐다.
	// @param _filter: 검색어
	private RefreshList(_filter: string): void
	{
		const query = _filter.toLowerCase();
		const ids = ThemeManager.List()
			.filter((_t) => _t.Id.toLowerCase().includes(query))
			.map((_t) => _t.Id);
		this.list_.SetItems(ids);
		const current = Settings.Get<string>("Theme.Id", "oc-2");
		this.list_.SelectedItem = ids.includes(current) ? current : null;
	}
}
