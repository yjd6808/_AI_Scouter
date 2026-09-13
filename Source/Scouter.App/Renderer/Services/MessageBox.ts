/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: MessageBox. App 모달·바탕화면 topmost 확인창을 한 입구로 쏜다.
*/

import { UIManager } from "@scouter/gui";
import { Ipc } from "./Ipc";
import { IpcChannels } from "../../Shared/IpcChannels";
import { GlobalMessageBox } from "./GlobalMessageBox";

export type TMessageBoxScope = "App" | "Global";
export type TMessageBoxKind = "ok" | "yesno";
export type TMessageBoxResult = "ok" | "yes" | "no" | "timeout" | "closed";

export interface IMessageBoxOptions
{
	Scope: TMessageBoxScope;
	Title: string;
	Message?: string | undefined;
	Kind?: TMessageBoxKind | undefined;
	DurationMs?: number | undefined;
	Topmost?: boolean | undefined;
	OnResult?: ((_result: TMessageBoxResult) => void) | undefined;
}

const kGlobalDefaultMs = 30000;

export class MessageBox
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 확인창을 띄우고 버튼 결과를 돌려준다. 콜백도 함께 부른다.
	// @param _opts: 범위·제목·내용·종류·지속·최상위·콜백
	public static async ShowAsync(_opts: IMessageBoxOptions): Promise<TMessageBoxResult>
	{
		const result = _opts.Scope === "Global"
			? await GlobalMessageBox.ShowAsync({ Title: _opts.Title, Message: _opts.Message, Kind: _opts.Kind ?? "ok", DurationMs: _opts.DurationMs ?? kGlobalDefaultMs })
			: await MessageBox.ShowAppAsync(_opts);
		_opts.OnResult?.(result);
		return result;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 다이얼로그 반환을 결과명으로 굳힌다. 모르면 닫힘·타임아웃으로 나눈다.
	// @param _back: 반환 값
	// @param _timeoutMs: 타임아웃
	public static MapResult(_back: unknown, _timeoutMs: number): TMessageBoxResult
	{
		if (_back === "ok" || _back === "yes" || _back === "no")
			return _back;
		return _timeoutMs > 0 ? "timeout" : "closed";
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 앱 모달로 띄운다. Topmost면 그 동안 주 창을 핀한다.
	// @param _opts: 옵션
	private static async ShowAppAsync(_opts: IMessageBoxOptions): Promise<TMessageBoxResult>
	{
		const timeoutMs = Math.max(0, Math.round(_opts.DurationMs ?? 0));
		let pinned = false;
		if (_opts.Topmost === true)
			pinned = await MessageBox.PinMainAsync(true);
		try
		{
			const back = await UIManager.ShowDialogAsync<unknown>("MessageBox", {
				title: _opts.Title,
				message: _opts.Message ?? "",
				mode: _opts.Kind ?? "ok",
			}, timeoutMs);
			return MessageBox.MapResult(back, timeoutMs);
		}
		finally
		{
			if (pinned)
				await MessageBox.PinMainAsync(false);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 주 창 핀을 켜고 끈다. 바꿨을 때만 true. Main 없으면 false.
	// @param _on: 핀 여부
	private static async PinMainAsync(_on: boolean): Promise<boolean>
	{
		try
		{
			const prev = await Ipc.Invoke<boolean>(IpcChannels.WindowIsTopmost);
			if (prev === null || prev === _on)
				return false;
			await Ipc.Invoke<boolean>(IpcChannels.WindowSetTopmost, { On: _on });
			return true;
		}
		catch
		{
			return false;
		}
	}
}
