/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 설정 다이얼로그 코드비하인드. 테마·스킴·글꼴·밀도를 묶는다.
*/

import { Window, Button, ComboBox, NumericUpDown, DataList, RegisterWindow, UIManager, DisposableBag } from "@scouter/gui";
import type { DensityKind, ThemeMode } from "@scouter/gui";
import { Settings } from "../Services/Settings";
import { ThemeManager } from "../Theme/ThemeManager";

@RegisterWindow("Settings")
export class SettingsWindow extends Window
{
	// ==================== 멤버 ====================
	private applying_ = false;
	private readonly bag_ = new DisposableBag();

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨트롤을 채우고 설정과 잇는다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		const theme = this.RequireName(ComboBox, "cmb_theme");
		theme.SetItems(ThemeManager.List().map((_t) => _t.Id));
		theme.SelectedItem = Settings.Get<string>("Theme.Id", "oc-2");
		theme.SelectionChanged.Add(() =>
		{
			if (this.applying_)
				return;
			const item = theme.SelectedItem;
			if (typeof item === "string")
				Settings.Set("Theme.Id", item);
		});
		const scheme = this.RequireName(ComboBox, "cmb_scheme");
		scheme.SetItems(["System", "Dark", "Light"]);
		scheme.SelectedItem = Settings.Get<ThemeMode>("Theme.Scheme", "System");
		scheme.SelectionChanged.Add(() =>
		{
			if (this.applying_)
				return;
			const item = scheme.SelectedItem;
			if (typeof item === "string")
				Settings.Set("Theme.Scheme", item);
		});
		const fontSize = this.RequireName(NumericUpDown, "num_fontsize");
		fontSize.Value = Settings.Get<number>("Theme.FontSize", 13);
		fontSize.ValueChanged.Add((_s, _a) =>
		{
			if (!this.applying_)
				Settings.Set("Theme.FontSize", _a.NewValue);
		});
		const density = this.RequireName(ComboBox, "cmb_density");
		density.SetItems(["Normal", "Compact"]);
		density.SelectedItem = Settings.Get<DensityKind>("Theme.Density", "Normal");
		density.SelectionChanged.Add(() =>
		{
			if (this.applying_)
				return;
			const item = density.SelectedItem;
			if (typeof item === "string")
				Settings.Set("Theme.Density", item);
		});
		this.bag_.Add(Settings.Changed.Add((_change) => { this.OnSettingsChanged(_change.Key); }));
		this.FindName(Button, "btn_open_theme_picker")?.Click.Add(() =>
		{
			void UIManager.ShowDialogAsync("ThemePicker");
		});
		this.FindName(Button, "btn_close")?.Click.Add(() =>
		{
			this.Close(undefined);
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Release settings subscription. Called after close.
	protected override OnClosed(): void
	{
		this.bag_.Dispose();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 외부 변경을 콤보에 되돌린다. 피커·팔레트 경로용.
	// @param _key: 설정 키
	private OnSettingsChanged(_key: string): void
	{
		if (!_key.startsWith("Theme."))
			return;
		this.applying_ = true;
		try
		{
			if (_key === "Theme.Id")
				this.RequireName(ComboBox, "cmb_theme").SelectedItem = Settings.Get<string>("Theme.Id", "oc-2");
			else if (_key === "Theme.Scheme")
				this.RequireName(ComboBox, "cmb_scheme").SelectedItem = Settings.Get<ThemeMode>("Theme.Scheme", "System");
			else if (_key === "Theme.FontSize")
				this.RequireName(NumericUpDown, "num_fontsize").Value = Settings.Get<number>("Theme.FontSize", 13);
			else if (_key === "Theme.Density")
				this.RequireName(ComboBox, "cmb_density").SelectedItem = Settings.Get<DensityKind>("Theme.Density", "Normal");
		}
		finally
		{
			this.applying_ = false;
		}
	}
}
