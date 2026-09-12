/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ToastService. UIManager 토스트 레이어 위의 정적 파사드.
*/

import { UIElement } from "../../Core/UIElement";
import { UIManager, ToastKind } from "../../Host/UIManager";
import type { IToastOptions } from "../../Host/UIManager";

export class ToastService
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 토스트를 띄운다.
	// @param _opts: 옵션
	public static Show(_opts: IToastOptions): void
	{
		UIManager.ShowToast(_opts);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 정보 토스트.
	// @param _msg: 메시지
	public static Info(_msg: string): void
	{
		UIManager.ShowToast({ Title: _msg, Variant: ToastKind.Info });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 성공 토스트.
	// @param _msg: 메시지
	public static Success(_msg: string): void
	{
		UIManager.ShowToast({ Title: _msg, Variant: ToastKind.Success });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 경고 토스트.
	// @param _msg: 메시지
	public static Warn(_msg: string): void
	{
		UIManager.ShowToast({ Title: _msg, Variant: ToastKind.Warn });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에러 토스트. 수동 닫기.
	// @param _msg: 메시지
	public static Error(_msg: string): void
	{
		UIManager.ShowToast({ Title: _msg, Variant: ToastKind.Error, DurationMs: 0 });
	}
}

export type { IToastOptions };
export type ToastHandle = UIElement | null;
