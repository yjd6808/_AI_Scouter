/*
	작성자: 윤정도
	생성일: 2026-09-14
	=====
	설명: MainSettingsSync. Main이 소비하는 App.* 설정을 IPC로 즉시 밀어준다.
*/

import { Settings } from "./Settings";
import { Ipc } from "./Ipc";
import { IpcChannels } from "../../Shared/IpcChannels";

export class MainSettingsSync
{
	// ==================== 정적 ====================
	private static s_synced_ = false;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 값을 한 번 보내고, 이후 Settings.Changed마다 다시 보낸다.
	// Main은 부팅 시 settings.json으로 초기값을 잡으므로 여기는 "재시작 없이 즉시 반영" 경로다.
	public static Sync(): void
	{
		MainSettingsSync.ApplyCloseToTray();
		MainSettingsSync.ApplyAutoStart();
		if (MainSettingsSync.s_synced_)
			return;
		MainSettingsSync.s_synced_ = true;
		Settings.Changed.Add((_change) =>
		{
			if (_change.Key === "App.CloseToTray")
				MainSettingsSync.ApplyCloseToTray();
			else if (_change.Key === "App.AutoStart")
				MainSettingsSync.ApplyAutoStart();
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫기→트레이 숨김 설정을 Main의 close 핸들러에 반영한다.
	private static ApplyCloseToTray(): void
	{
		const enabled = Settings.Get<boolean>("App.CloseToTray", true);
		void Ipc.Invoke(IpcChannels.AppSetCloseToTray, { Enabled: enabled }).catch(() => undefined);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그인 자동 실행 설정을 OS 로그인 항목에 반영한다. 끄면 해제까지 간다.
	private static ApplyAutoStart(): void
	{
		const enabled = Settings.Get<boolean>("App.AutoStart", false);
		void Ipc.Invoke(IpcChannels.AppSetAutoStart, { Enabled: enabled }).catch(() => undefined);
	}
}
