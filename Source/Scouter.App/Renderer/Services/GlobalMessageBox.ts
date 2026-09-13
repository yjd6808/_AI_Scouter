/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: GlobalMessageBox. 바탕화면 topmost 확인창에 IPC로 쏜다.
*/

import { Ipc } from "./Ipc";
import { IpcChannels } from "../../Shared/IpcChannels";
import type { TMessageBoxKind, TMessageBoxResult } from "./MessageBox";

export interface IGlobalMessageBoxOptions
{
	Title: string;
	Message?: string | undefined;
	Kind?: TMessageBoxKind | undefined;
	DurationMs?: number | undefined;
}

const kResults: ReadonlyArray<string> = ["ok", "yes", "no", "timeout", "closed"];

export class GlobalMessageBox
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 바탕화면 확인창을 띄운다. Main 없으면 closed.
	// @param _opts: 제목·내용·종류·지속
	public static async ShowAsync(_opts: IGlobalMessageBoxOptions): Promise<TMessageBoxResult>
	{
		const theme = document.getElementById("scouter-theme")?.textContent ?? "";
		const payload: Record<string, unknown> = {
			Title: _opts.Title,
			Kind: _opts.Kind ?? "ok",
			DurationMs: Math.max(0, Math.round(_opts.DurationMs ?? 30000)),
			ThemeCss: theme,
		};
		if (_opts.Message !== undefined && _opts.Message.length > 0)
			payload["Message"] = _opts.Message;
		try
		{
			const back = await Ipc.Invoke<string>(IpcChannels.MessageShow, payload);
			return typeof back === "string" && kResults.includes(back) ? back as TMessageBoxResult : "closed";
		}
		catch
		{
			return "closed";
		}
	}
}
