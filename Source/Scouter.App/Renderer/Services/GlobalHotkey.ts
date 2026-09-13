/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: GlobalHotkey. 설정 핫키를 Main에 동기화한다.
*/

import { ToastService } from "@scouter/gui";
import { Settings } from "./Settings";
import { Ipc } from "./Ipc";
import { Log } from "./Log";
import { IpcChannels } from "../../Shared/IpcChannels";

export class GlobalHotkey
{
	// ==================== 정적 ====================
	private static s_synced_ = false;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 핫키를 Main에 등록한다. 변경 때도 다시 건다.
	public static Sync(): void
	{
		GlobalHotkey.Apply();
		if (GlobalHotkey.s_synced_)
			return;
		GlobalHotkey.s_synced_ = true;
		Settings.Changed.Add((_change) =>
		{
			if (_change.Key === "Hotkeys.Global.Show")
				GlobalHotkey.Apply();
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 설정값을 전송한다. 등록 실패(충돌)는 토스트·로그로 알린다.
	private static Apply(): void
	{
		const accelerator = Settings.Get<string>("Hotkeys.Global.Show", "Ctrl+Shift+Space");
		void Ipc.Invoke<{ Ok?: boolean }>(IpcChannels.AppSetGlobalHotkey, { Accelerator: accelerator })
			.then((_back) =>
			{
				if ((_back?.Ok ?? false) || accelerator.length === 0)
					return;
				Log.Warn("GlobalHotkey", `등록 실패(충돌 가능): ${accelerator}`);
				ToastService.Warn(`전역 단축키 등록 실패: ${accelerator} (설정 Hotkeys.Global.Show 확인)`);
			})
			.catch(() => undefined);
	}
}
