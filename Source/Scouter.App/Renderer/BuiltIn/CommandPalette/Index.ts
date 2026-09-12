/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CommandPalette 내장 Plugin. Ctrl+Shift+P 토글.
*/

import { UIManager } from "@scouter/gui";
import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import { PaletteWindow } from "./Views/PaletteWindow";
import { MainView } from "./Views/MainView";

export default class CommandPalettePlugin extends PluginBase
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 메인 뷰·열기 명령을 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		PaletteWindow.Configure({ Plugins: () => _ctx.App.Plugins(), Storage: _ctx.Storage });
		_ctx.Ui.RegisterWindow("Main", MainView);
		_ctx.Commands.Register("Open", {
			Title: "명령 팔레트 열기",
			Hotkey: "Ctrl+Shift+P",
			Run: () =>
			{
				CommandPalettePlugin.Toggle();
			},
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 열려 있으면 닫고, 닫혀 있으면 Popup으로 연다.
	private static Toggle(): void
	{
		const found = UIManager.Find("CommandPalette/Palette");
		if (found !== null && !found.IsClosed)
		{
			UIManager.Close(found);
			return;
		}
		void UIManager.ShowPopupAsync("CommandPalette/Palette").catch(() => undefined);
	}
}
