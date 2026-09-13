/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Shell.* 명령 10개. 사이드바·다이얼로그·이동·리로드를 묶는다.
*/

import { CommandRegistry } from "../Services/CommandRegistry";
import { Settings } from "../Services/Settings";
import { Ipc } from "../Services/Ipc";
import { UIManager } from "@scouter/gui";
import { PluginManager } from "../Plugin/PluginManager";
import type { ShellWindow } from "./ShellWindow";

export class ShellCommands
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 셸 명령을 등록한다.
	// @param _shell: 셸 창
	public static Register(_shell: ShellWindow): void
	{
		CommandRegistry.Register({
			Id: "Shell.ToggleSidebar", Title: "사이드바 토글", Category: "Shell", Hotkey: "Ctrl+B",
			Execute: () => { Settings.Set("Ui.SidebarCollapsed", !Settings.Get<boolean>("Ui.SidebarCollapsed")); },
		});
		CommandRegistry.Register({
			Id: "Shell.OpenSettings", Title: "설정 열기", Category: "Shell", Hotkey: "Ctrl+,",
			Execute: () => { _shell.OpenSettings(); },
		});
		CommandRegistry.Register({
			Id: "Shell.OpenAbout", Title: "정보 열기", Category: "Shell",
			Execute: () => { _shell.OpenAbout(); },
		});
		CommandRegistry.Register({
			Id: "Shell.OpenThemePicker", Title: "테마 선택", Category: "Shell", Hotkey: "Ctrl+K Ctrl+T",
			Execute: () => { void UIManager.ShowDialogAsync("ThemePicker"); },
		});
		CommandRegistry.Register({
			Id: "Shell.NextPlugin", Title: "다음 Plugin", Category: "Shell", Hotkey: "Ctrl+Tab",
			Execute: () => { _shell.CycleView(1); },
		});
		CommandRegistry.Register({
			Id: "Shell.PrevPlugin", Title: "이전 Plugin", Category: "Shell", Hotkey: "Ctrl+Shift+Tab",
			Execute: () => { _shell.CycleView(-1); },
		});
		CommandRegistry.Register({
			Id: "Shell.ReloadLayout", Title: "레이아웃 다시 읽기", Category: "Shell", Hotkey: "Ctrl+R",
			Execute: () =>
			{
				const active = UIManager.Active;
				if (active !== null)
					void UIManager.Reload(active);
			},
		});
		CommandRegistry.Register({
			Id: "Shell.ReloadPlugin", Title: "Plugin 다시 로드", Category: "Shell", Hotkey: "F5",
			Execute: () =>
			{
				const id = _shell.CurrentPluginId();
				if (id.length > 0)
					void PluginManager.ReloadAsync(id);
			},
		});
		CommandRegistry.Register({
			Id: "Shell.ToggleDevTools", Title: "개발자 도구", Category: "Shell", Hotkey: "F12",
			Execute: () => { void Ipc.Invoke("window:toggle-devtools"); },
		});
		CommandRegistry.Register({
			Id: "Shell.ShowPlugin", Title: "Plugin 보기", Category: "Shell",
			Execute: (_param) =>
			{
				const id = (_param as { Id?: unknown } | undefined)?.Id;
				if (typeof id === "string")
					_shell.Navigate(id);
			},
		});
	}
}
