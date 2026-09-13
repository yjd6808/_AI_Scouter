/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: GlobalToastWindow. 바탕화면 우측 하단 topmost 알림 창. 앱 Toast와 같은 모양.
*/

import { BrowserWindow, ipcMain, screen } from "electron";
import * as path from "node:path";
import { IpcChannels } from "../Shared/IpcChannels";
import type { INotifyPush } from "../Shared/IpcChannels";

const kWidth = 376;
const kMargin = 16;
const kMaxHeight = 600;

export class GlobalToastWindow
{
	// ==================== 정적 ====================
	private static s_win_: BrowserWindow | null = null;
	private static s_focusMain_: (() => void) | null = null;
	private static s_armed_ = false;
	private static s_seq_ = 0;
	private static s_ready_ = false;
	private static readonly s_pending_: INotifyPush[] = [];

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 알림 채널을 건다. 중복 호출 안전. 토스트 클릭은 _focusMain으로 온다.
	// @param _focusMain: 메인 창 표시·포커스
	public static Arm(_focusMain: () => void): void
	{
		GlobalToastWindow.s_focusMain_ = _focusMain;
		if (GlobalToastWindow.s_armed_)
			return;
		GlobalToastWindow.s_armed_ = true;
		ipcMain.handle(IpcChannels.NotifyShow, (_e, _payload) => GlobalToastWindow.OnShow(_payload));
		ipcMain.on(IpcChannels.NotifyReady, () => { GlobalToastWindow.OnReady(); });
		ipcMain.on(IpcChannels.NotifyHeight, (_e, _h) => { GlobalToastWindow.OnHeight(_h); });
		ipcMain.on(IpcChannels.NotifyEmpty, () => { GlobalToastWindow.Hide(); });
		ipcMain.on(IpcChannels.NotifyClick, () => { GlobalToastWindow.s_focusMain_?.(); });
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 알림 1건을 띄운다. 창은 필요할 때 만든다.
	// @param _payload: 제목·내용·종류·지속·테마
	private static OnShow(_payload: unknown): boolean
	{
		const data = _payload as Partial<INotifyPush> | null;
		if (data === null || typeof data !== "object" || typeof data.Title !== "string")
			return false;
		GlobalToastWindow.s_seq_ += 1;
		const push: INotifyPush = {
			Id: GlobalToastWindow.s_seq_,
			Title: data.Title,
			Variant: typeof data.Variant === "string" ? data.Variant : "info",
			DurationMs: typeof data.DurationMs === "number" && data.DurationMs >= 0 ? Math.round(data.DurationMs) : 4000,
			ThemeCss: typeof data.ThemeCss === "string" ? data.ThemeCss : "",
		};
		if (typeof data.Message === "string" && data.Message.length > 0)
			push.Message = data.Message;
		const win = GlobalToastWindow.Ensure();
		if (win === null)
			return false;
		if (GlobalToastWindow.s_ready_)
			win.webContents.send(IpcChannels.NotifyPush, push);
		else
			GlobalToastWindow.s_pending_.push(push);
		if (!win.isVisible())
			win.showInactive();
		win.moveTop();
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 페이지 준비. 밀린 푸시를 flush한다.
	private static OnReady(): void
	{
		GlobalToastWindow.s_ready_ = true;
		const win = GlobalToastWindow.s_win_;
		if (win === null || win.isDestroyed())
			return;
		for (const push of GlobalToastWindow.s_pending_.splice(0))
			win.webContents.send(IpcChannels.NotifyPush, push);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 내용 높이에 맞춰 창을 키운 뒤 우하단에 붙인다.
	// @param _h: 내용 높이 px
	private static OnHeight(_h: unknown): void
	{
		const win = GlobalToastWindow.s_win_;
		if (win === null || typeof _h !== "number" || !Number.isFinite(_h))
			return;
		const height = Math.min(Math.max(Math.round(_h), 80), kMaxHeight);
		const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
		win.setSize(kWidth, height);
		win.setPosition(area.x + area.width - kWidth - kMargin, area.y + area.height - height - kMargin);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 빈 상태면 숨긴다. 투명 창이 클릭을 가로채지 않게.
	private static Hide(): void
	{
		GlobalToastWindow.s_win_?.hide();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창을 만든다. 닫히면 다음 표시 때 다시 만든다.
	private static Ensure(): BrowserWindow | null
	{
		if (GlobalToastWindow.s_win_ !== null && !GlobalToastWindow.s_win_.isDestroyed())
			return GlobalToastWindow.s_win_;
		try
		{
			const win = new BrowserWindow({
				width: kWidth, height: 120, show: false, frame: false, transparent: true,
				alwaysOnTop: true, skipTaskbar: true, resizable: false, minimizable: false,
				maximizable: false, fullscreenable: false, focusable: false, hasShadow: false,
				backgroundColor: "#00000000",
				webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false, spellcheck: false },
			});
			void win.loadFile(path.join(__dirname, "../renderer/Notify.html"));
			win.on("closed", () =>
			{
				if (GlobalToastWindow.s_win_ === win)
				{
					GlobalToastWindow.s_win_ = null;
					GlobalToastWindow.s_ready_ = false;
				}
			});
			GlobalToastWindow.s_win_ = win;
			return win;
		}
		catch
		{
			return null;
		}
	}
}
