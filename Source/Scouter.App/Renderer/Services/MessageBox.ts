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
import type { IGlobalMessageBoxOptions } from "./GlobalMessageBox";

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
	FocusMain?: boolean | undefined;
	OnResult?: ((_result: TMessageBoxResult) => void) | undefined;
}

const kGlobalDefaultMs = 30000;

export class MessageBox
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 확인창을 띄우고 버튼 결과를 돌려준다. 콜백도 함께 부른다.
	// @param _opts: 범위·제목·내용·종류·지속·최상위·주 창 포그라운드·콜백
	public static async ShowAsync(_opts: IMessageBoxOptions): Promise<TMessageBoxResult>
	{
		const result = _opts.Scope === "Global"
			? await GlobalMessageBox.ShowAsync(MessageBox.GlobalOptionsOf(_opts))
			: await MessageBox.ShowAppAsync(_opts);
		_opts.OnResult?.(result);
		return result;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전역 확인창 옵션으로 옮긴다. 부수효과 없는 순수 함수.
	// Topmost는 전역 창 자체를 최상위로 띄우고, FocusMain은 그때 주 창을 앞으로 끌어온다.
	// 둘 다 명시적으로 false를 준 경우에만 꺼진다. 알람처럼 놓치면 안 되는 표시가 기본이라서다.
	// @param _opts: 원본 옵션
	public static GlobalOptionsOf(_opts: IMessageBoxOptions): IGlobalMessageBoxOptions
	{
		return {
			Title: _opts.Title,
			Message: _opts.Message,
			Kind: _opts.Kind ?? "ok",
			DurationMs: _opts.DurationMs ?? kGlobalDefaultMs,
			Topmost: _opts.Topmost !== false,
			FocusMain: _opts.FocusMain !== false,
		};
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
