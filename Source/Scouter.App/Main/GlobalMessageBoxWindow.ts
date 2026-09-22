/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: GlobalMessageBoxWindow. 바탕화면 중앙 topmost 확인창. 1개씩 차례로 띄운다.
*/

import { BrowserWindow, ipcMain, screen } from "electron";
import * as path from "node:path";
import { IpcChannels } from "../Shared/IpcChannels";
import type { IMessageShow } from "../Shared/IpcChannels";

const kWidth = 400;
const kMaxHeight = 480;

export interface IGlobalMessageBoxHooks
{
	// 주 창을 앞으로 끌어온다. 인자는 이번 표시가 그걸 원했는지 여부.
	FocusMain(_wanted: boolean): void;
	// 주 창 작업 표시줄 아이콘 깜빡임을 켜고 끈다.
	Flash(_on: boolean): void;
}

interface IQueuedMessage
{
	Show: IMessageShow;
	Resolve: (_result: string) => void;
}

const kResults: ReadonlyArray<string> = ["ok", "yes", "no", "timeout", "closed"];

export class GlobalMessageBoxWindow
{
	// ==================== 정적 ====================
	private static s_win_: BrowserWindow | null = null;
	private static s_hooks_: IGlobalMessageBoxHooks | null = null;
	private static s_armed_ = false;
	private static s_seq_ = 0;
	private static s_ready_ = false;
	private static s_current_: IQueuedMessage | null = null;
	private static readonly s_queue_: IQueuedMessage[] = [];
	private static readonly s_pending_: IMessageShow[] = [];

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 확인창 채널을 건다. 중복 호출 안전. 표시 직전 주 창 Foreground·깜빡임은 _hooks로 맡긴다.
	// @param _hooks: 주 창 포그라운드·작업 표시줄 깜빡임 조작
	public static Arm(_hooks: IGlobalMessageBoxHooks): void
	{
		GlobalMessageBoxWindow.s_hooks_ = _hooks;
		if (GlobalMessageBoxWindow.s_armed_)
			return;
		GlobalMessageBoxWindow.s_armed_ = true;
		ipcMain.handle(IpcChannels.MessageShow, (_e, _payload) => GlobalMessageBoxWindow.OnShow(_payload));
		ipcMain.on(IpcChannels.MessageReady, () => { GlobalMessageBoxWindow.OnReady(); });
		ipcMain.on(IpcChannels.MessageHeight, (_e, _h) => { GlobalMessageBoxWindow.OnHeight(_h); });
		ipcMain.on(IpcChannels.MessageResult, (_e, _payload) => { GlobalMessageBoxWindow.OnResult(_payload); });
		ipcMain.on(IpcChannels.MessageClosed, (_e, _payload) => { GlobalMessageBoxWindow.OnResult(_payload); });
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 확인 1건을 큐에 넣고 차례를 기다린다. 결과명으로 풀리는 Promise를 돌려준다.
	// Topmost·FocusMain·Flash는 안 보내면 켜진 값으로 본다. 기존 호출자는 늘 최상위로 떴었다.
	// @param _payload: 제목·내용·종류·지속·최상위·주 창 포그라운드·테마
	private static OnShow(_payload: unknown): Promise<string>
	{
		const data = _payload as Partial<IMessageShow> | null;
		if (data === null || typeof data !== "object" || typeof data.Title !== "string")
			return Promise.resolve("closed");
		GlobalMessageBoxWindow.s_seq_ += 1;
		const show: IMessageShow = {
			Id: GlobalMessageBoxWindow.s_seq_,
			Title: data.Title,
			Kind: data.Kind === "yesno" ? "yesno" : "ok",
			DurationMs: typeof data.DurationMs === "number" && data.DurationMs >= 0 ? Math.round(data.DurationMs) : 30000,
			Topmost: typeof data.Topmost === "boolean" ? data.Topmost : true,
			FocusMain: typeof data.FocusMain === "boolean" ? data.FocusMain : true,
			Flash: typeof data.Flash === "boolean" ? data.Flash : true,
			ThemeCss: typeof data.ThemeCss === "string" ? data.ThemeCss : "",
		};
		if (typeof data.Message === "string" && data.Message.length > 0)
			show.Message = data.Message;
		return new Promise<string>((_resolve) =>
		{
			GlobalMessageBoxWindow.s_queue_.push({ Show: show, Resolve: _resolve });
			GlobalMessageBoxWindow.Pump();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 대기열 앞에서 1건을 꺼내 띄운다. 창은 필요할 때 만든다.
	private static Pump(): void
	{
		if (GlobalMessageBoxWindow.s_current_ !== null)
			return;
		const next = GlobalMessageBoxWindow.s_queue_.shift();
		if (next === undefined)
			return;
		const win = GlobalMessageBoxWindow.Ensure();
		if (win === null)
		{
			next.Resolve("closed");
			GlobalMessageBoxWindow.Pump();
			return;
		}
		GlobalMessageBoxWindow.s_current_ = next;
		if (GlobalMessageBoxWindow.s_ready_)
			win.webContents.send(IpcChannels.MessagePush, next.Show);
		else
			GlobalMessageBoxWindow.s_pending_.push(next.Show);
		// 주 창을 먼저 올리고 확인창을 그 위에 얹는다. 순서가 뒤집히면 확인창이 주 창 밑으로 들어간다.
		GlobalMessageBoxWindow.s_hooks_?.FocusMain(next.Show.FocusMain);
		// Foreground가 통했으면 Windows가 깜빡임을 알아서 무시한다. 거절당한 경우에만 이게 남아 표시가 된다.
		if (next.Show.Flash)
			GlobalMessageBoxWindow.s_hooks_?.Flash(true);
		// Windows에서 topmost는 레벨 구분이 없지만(전부 HWND_TOPMOST), 다른 앱의 상시 최상위 창보다
		// 뒤로 밀리지 않도록 가장 높은 screen-saver 레벨로 건다. Topmost가 꺼진 표시는 보통 창으로 둔다.
		if (next.Show.Topmost)
			win.setAlwaysOnTop(true, "screen-saver");
		else
			win.setAlwaysOnTop(false);
		if (!win.isVisible())
			win.show();
		win.focus();
		win.moveTop();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 페이지 준비. 밀린 표시를 flush한다.
	private static OnReady(): void
	{
		GlobalMessageBoxWindow.s_ready_ = true;
		const win = GlobalMessageBoxWindow.s_win_;
		if (win === null || win.isDestroyed())
			return;
		for (const show of GlobalMessageBoxWindow.s_pending_.splice(0))
			win.webContents.send(IpcChannels.MessagePush, show);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 내용 높이에 맞춰 창을 키운 뒤 화면 가운데에 둔다.
	// @param _h: 내용 높이 px
	private static OnHeight(_h: unknown): void
	{
		const win = GlobalMessageBoxWindow.s_win_;
		if (win === null || typeof _h !== "number" || !Number.isFinite(_h))
			return;
		const height = Math.min(Math.max(Math.round(_h), 120), kMaxHeight);
		const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
		win.setSize(kWidth, height);
		win.setPosition(Math.round(area.x + (area.width - kWidth) / 2), Math.round(area.y + (area.height - height) / 2));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 버튼·닫힘 결과를 돌려주고 다음 대기열을 띄운다.
	// @param _payload: 결과명 또는 결과 묶음
	private static OnResult(_payload: unknown): void
	{
		const current = GlobalMessageBoxWindow.s_current_;
		if (current === null)
			return;
		const raw = typeof _payload === "string"
			? _payload
			: (_payload as { Result?: unknown } | null)?.Result;
		const result = typeof raw === "string" && kResults.includes(raw) ? raw : "closed";
		GlobalMessageBoxWindow.s_current_ = null;
		GlobalMessageBoxWindow.s_win_?.hide();
		GlobalMessageBoxWindow.s_hooks_?.Flash(false);
		current.Resolve(result);
		GlobalMessageBoxWindow.Pump();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창을 만든다. 닫히면 다음 표시 때 다시 만든다.
	private static Ensure(): BrowserWindow | null
	{
		if (GlobalMessageBoxWindow.s_win_ !== null && !GlobalMessageBoxWindow.s_win_.isDestroyed())
			return GlobalMessageBoxWindow.s_win_;
		try
		{
			const win = new BrowserWindow({
				width: kWidth, height: 200, show: false, frame: false, transparent: true,
				alwaysOnTop: true, skipTaskbar: true, resizable: false, minimizable: false,
				maximizable: false, fullscreenable: false, focusable: true, hasShadow: false,
				backgroundColor: "#00000000",
				webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false, spellcheck: false },
			});
			void win.loadFile(path.join(__dirname, "../renderer/Message.html"));
			win.on("closed", () =>
			{
				if (GlobalMessageBoxWindow.s_win_ === win)
				{
					GlobalMessageBoxWindow.s_win_ = null;
					GlobalMessageBoxWindow.s_ready_ = false;
				}
				const current = GlobalMessageBoxWindow.s_current_;
				if (current !== null)
				{
					GlobalMessageBoxWindow.s_current_ = null;
					GlobalMessageBoxWindow.s_hooks_?.Flash(false);
					current.Resolve("closed");
					GlobalMessageBoxWindow.Pump();
				}
			});
			GlobalMessageBoxWindow.s_win_ = win;
			return win;
		}
		catch
		{
			return null;
		}
	}
}
