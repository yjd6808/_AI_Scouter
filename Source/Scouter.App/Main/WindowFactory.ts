/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Main 프로세스 창 생성. P0에서는 최소 옵션 + 경계 저장만 한다.
*/

import { BrowserWindow } from "electron";
import * as path from "node:path";
import { LaunchArgs } from "./LaunchArgs";

export class WindowFactory
{
	// ==================== 정적 ====================
	private static s_current_: BrowserWindow | null = null;

	// ==================== 속성 ====================
	public static get Current(): BrowserWindow | null { return WindowFactory.s_current_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 프레임없는 주 창을 만든다.
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
		WindowFactory.s_current_ = win;
		return win;
	}
}
