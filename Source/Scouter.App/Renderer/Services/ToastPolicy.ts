/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ToastPolicy. App·Global 토스트 지속시간을 기본값에 싣는다.
*/

import { UIManager } from "@scouter/gui";
import { Settings } from "./Settings";

export class ToastPolicy
{
	// ==================== 정적 ====================
	private static s_synced_ = false;
	private static s_globalMs_ = 4000;

	// ==================== 속성 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 바탕화면 토스트 기본 지속시간을 구한다.
	public static get GlobalDurationMs(): number { return ToastPolicy.s_globalMs_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정값을 토스트 기본값에 싣는다. 중복 호출 안전.
	public static Sync(): void
	{
		if (ToastPolicy.s_synced_)
			return;
		ToastPolicy.s_synced_ = true;
		ToastPolicy.Apply();
		Settings.Changed.Add((_change) =>
		{
			if (_change.Key === "Ui.AppToastDurationSec" || _change.Key === "Ui.GlobalToastDurationSec")
				ToastPolicy.Apply();
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 초 단위 설정을 ms로 바꾼다. 인앱은 UIManager, 바탕화면은 자체 보관.
	private static Apply(): void
	{
		UIManager.DefaultToastDurationMs = Settings.Get<number>("Ui.AppToastDurationSec", 4) * 1000;
		ToastPolicy.s_globalMs_ = Math.max(0, Math.round(Settings.Get<number>("Ui.GlobalToastDurationSec", 4) * 1000));
	}
}
