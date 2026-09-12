/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MainWindow. 주 창 생성·표시 토글·닫기 가로채기.
*/

import { BrowserWindow } from "electron";
import * as path from "node:path";
import { LaunchArgs } from "./LaunchArgs";

export class MainWindow
{
	// ==================== 정적 ====================
	private static s_current_: BrowserWindow | null = null;
	private static s_quitting_ = false;

	// ==================== 속성 ====================
	public static get Current(): BrowserWindow | null { return MainWindow.s_current_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 프레임없는 주 창을 만든다. 닫기는 기본 숨김(트레이).
	// @param _args: 실행 인자
	public static Create(_args: LaunchArgs): BrowserWindow
	{
		const win = new BrowserWindow(
			{
				width: 1280, height: 800, minWidth: 800, minHeight: 500, show: false,
				frame: false, titleBarStyle: "hidden",
				backgroundColor: "#1e1e1e",
				webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false, webviewTag: false, spellcheck: false, additionalArguments: _args.Raw },
			});
		void win.loadFile(path.join(__dirname, "../renderer/Index.html"));
		win.on("close", (_e) =>
		{
			if (!MainWindow.s_quitting_)
			{
				_e.preventDefault();
				win.hide();
			}
		});
		MainWindow.s_current_ = win;
		return win;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 숨김·표시를 뒤집는다. 트레이 클릭용.
	public static ToggleVisible(): void
	{
		const win = MainWindow.s_current_;
		if (win === null)
			return;
		if (win.isVisible())
			win.hide();
		else
		{
			win.show();
			win.focus();
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 종료 모드로 둔다. 이후 close는 통과.
	public static SetQuitting(): void
	{
		MainWindow.s_quitting_ = true;
	}
}
