/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MainWindow. 주 창 생성·표시 토글·닫기 가로채기.
*/

import { app, BrowserWindow } from "electron";
import * as path from "node:path";
import { LaunchArgs } from "./LaunchArgs";
import { ForegroundPolicy } from "./ForegroundPolicy";

export class MainWindow
{
	// ==================== 정적 ====================
	private static s_current_: BrowserWindow | null = null;
	private static s_quitting_ = false;
	private static s_testMode_ = false;
	private static s_closeToTray_ = true;

	// ==================== 속성 ====================
	public static get Current(): BrowserWindow | null { return MainWindow.s_current_; }
	public static get CloseToTray(): boolean { return MainWindow.s_closeToTray_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 프레임없는 주 창을 만든다. 닫기 처리는 App.CloseToTray가 정한다.
	// @param _args: 실행 인자
	public static Create(_args: LaunchArgs): BrowserWindow
	{
		MainWindow.s_testMode_ = _args.Test;
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
			if (MainWindow.ShouldHideOnClose(MainWindow.s_quitting_, MainWindow.s_testMode_, MainWindow.s_closeToTray_))
			{
				_e.preventDefault();
				win.hide();
				return;
			}
			if (MainWindow.s_quitting_ || MainWindow.s_testMode_)
				return;
			// 트레이로 숨기지 않는 설정. before-quit 정리 절차를 태운 뒤 실제로 끝낸다.
			_e.preventDefault();
			app.quit();
		});
		MainWindow.s_current_ = win;
		return win;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫기→트레이 숨김 여부를 갱신한다. 부팅 시 settings.json, 이후 IPC로 들어온다.
	// @param _enabled: App.CloseToTray 값
	public static SetCloseToTray(_enabled: boolean): void
	{
		MainWindow.s_closeToTray_ = _enabled;
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
	// 주 창을 사용자 눈앞으로 끌어온다. 트레이 숨김·최소화·다른 앱 뒤 전부에서 복구한다.
	// Windows는 다른 프로세스가 포그라운드면 SetForegroundWindow(=focus())를 거절하고
	// 작업 표시줄만 깜빡이게 만든다. 그래서 restore()·show()로 창을 살린 뒤
	// alwaysOnTop을 잠깐 켠다. 이건 SetWindowPos(HWND_TOPMOST)라 포커스 권한과 무관하게
	// 창을 위로 올려 주고, 끌 때 HWND_NOTOPMOST가 비-topmost 무리의 맨 위에 남겨 주므로
	// 토글을 되돌려도 창이 다시 묻히지 않는다. focus()는 그 위에서 입력 포커스만 마저 챙긴다.
	// 사용자가 직접 켠 핀(TitleBar 핀 버튼)은 건드리지 않는다. 켜져 있었으면 그대로 둔다.
	// @param _requested: 호출 쪽이 Foreground를 원했는지
	public static BringToFront(_requested: boolean): void
	{
		if (!ForegroundPolicy.ShouldBringToFront(_requested, MainWindow.s_testMode_))
			return;
		const win = MainWindow.s_current_;
		if (win === null || win.isDestroyed())
			return;
		if (win.isMinimized())
			win.restore();
		const pinned = win.isAlwaysOnTop();
		if (!pinned)
			win.setAlwaysOnTop(true, "screen-saver");
		win.show();
		win.moveTop();
		win.focus();
		if (!pinned)
			win.setAlwaysOnTop(false);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 작업 표시줄 아이콘 깜빡임을 켜고 끈다. 포커스·z-order는 건드리지 않는다.
	// Windows는 이미 포그라운드인 창의 깜빡임 요청을 스스로 무시하므로 따로 거르지 않는다.
	// @param _on: 켤지 끌지
	public static Flash(_on: boolean): void
	{
		const win = MainWindow.s_current_;
		if (win === null || win.isDestroyed())
			return;
		win.flashFrame(_on);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 종료 모드로 둔다. 이후 close는 통과.
	public static SetQuitting(): void
	{
		MainWindow.s_quitting_ = true;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫기를 숨김으로 바꿀지 판정한다. 부수효과 없는 순수 함수.
	// @param _quitting: 종료가 확정된 상태인지
	// @param _testMode: --test 실행인지(트레이가 없어 복구 수단이 없다)
	// @param _closeToTray: App.CloseToTray 설정값
	private static ShouldHideOnClose(_quitting: boolean, _testMode: boolean, _closeToTray: boolean): boolean
	{
		return !_quitting && !_testMode && _closeToTray;
	}
}
