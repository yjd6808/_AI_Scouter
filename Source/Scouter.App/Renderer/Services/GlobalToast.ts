/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: GlobalToast. 바탕화면 topmost 알림 창에 앱 Toast와 같은 내용을 쏜다.
*/

import { ToastKind } from "@scouter/gui";
import { Ipc } from "./Ipc";
import { ToastPolicy } from "./ToastPolicy";
import { IpcChannels } from "../../Shared/IpcChannels";

export interface IGlobalToastOptions
{
	Title: string;
	Message?: string | undefined;
	Variant?: ToastKind;
	DurationMs?: number;
}

export class GlobalToast
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 바탕화면 알림을 띄운다. Main 없으면 false. 지속 기본값은 Global 표시 시간이다.
	// @param _opts: 제목·내용·종류·지속
	public static async NotifyAsync(_opts: IGlobalToastOptions): Promise<boolean>
	{
		const theme = document.getElementById("scouter-theme")?.textContent ?? "";
		const payload: Record<string, unknown> = {
			Title: _opts.Title,
			Variant: (_opts.Variant ?? ToastKind.Info).toLowerCase(),
			DurationMs: _opts.DurationMs ?? ToastPolicy.GlobalDurationMs,
			ThemeCss: theme,
		};
		if (_opts.Message !== undefined && _opts.Message.length > 0)
			payload["Message"] = _opts.Message;
		try
		{
			return await Ipc.Invoke<boolean>(IpcChannels.NotifyShow, payload) === true;
		}
		catch
		{
			return false;
		}
	}
}
