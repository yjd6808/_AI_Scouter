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
	Topmost?: boolean | undefined;
	FocusMain?: boolean | undefined;
}

const kResults: ReadonlyArray<string> = ["ok", "yes", "no", "timeout", "closed"];
const kDefaultMs = 30000;

export class GlobalMessageBox
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 바탕화면 확인창을 띄운다. Main 없으면 closed.
	// @param _opts: 제목·내용·종류·지속·최상위·주 창 포그라운드
	public static async ShowAsync(_opts: IGlobalMessageBoxOptions): Promise<TMessageBoxResult>
	{
		const theme = document.getElementById("scouter-theme")?.textContent ?? "";
		const payload = GlobalMessageBox.BuildPayload(_opts, theme);
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

	//////////////////////////////////////////////////////////////////////////////////////
	// Main으로 보낼 페이로드를 만든다. 부수효과 없는 순수 함수.
	// Topmost·FocusMain은 명시적으로 false를 준 경우에만 꺼진다(기본 켜짐).
	// @param _opts: 옵션
	// @param _themeCss: 창에 입힐 테마 CSS
	public static BuildPayload(_opts: IGlobalMessageBoxOptions, _themeCss: string): Record<string, unknown>
	{
		const payload: Record<string, unknown> = {
			Title: _opts.Title,
			Kind: _opts.Kind ?? "ok",
			DurationMs: Math.max(0, Math.round(_opts.DurationMs ?? kDefaultMs)),
			Topmost: _opts.Topmost !== false,
			FocusMain: _opts.FocusMain !== false,
			ThemeCss: _themeCss,
		};
		if (_opts.Message !== undefined && _opts.Message.length > 0)
			payload["Message"] = _opts.Message;
		return payload;
	}
}
