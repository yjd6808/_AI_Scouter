/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 정보 다이얼로그 코드비하인드. 버전·업데이트 + 닫기.
*/

import { Window, Button, DataList, RegisterWindow } from "@scouter/gui";
import { Paths } from "../Services/Paths";
import { Ipc } from "../Services/Ipc";
import { IpcChannels } from "../../Shared/IpcChannels";
import type { IUpdateStatus } from "../../Shared/IpcChannels";

@RegisterWindow("About")
export class AboutWindow extends Window
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫기·업데이트 버튼을 연결한다. 버전은 직접 채운다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		_data.Set("appVersion", Paths.Version);
		_data.Set("versions", `Electron ${process.versions["electron"]} · Node ${process.versions["node"]} · Chrome ${process.versions["chrome"]}`);
		_data.Set("updateState", "");
		Ipc.On(IpcChannels.AppUpdateStatus, (..._args) => { this.OnUpdateStatus(_args[0]); });
		this.FindName(Button, "btn_update")?.Click.Add(() =>
		{
			_data.Set("updateState", "확인 중…");
			void Ipc.Invoke(IpcChannels.AppUpdateCheck);
		});
		this.FindName(Button, "btn_restart")?.Click.Add(() =>
		{
			void Ipc.Invoke(IpcChannels.AppUpdateInstall);
		});
		const close = this.FindName(Button, "btn_close");
		close?.Click.Add(() =>
		{
			this.Close(undefined);
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 업데이트 상태를 한 줄에 표시한다.
	// @param _value: 상태 값
	private OnUpdateStatus(_value: unknown): void
	{
		const status = (_value ?? {}) as IUpdateStatus;
		if (status.State === "ready")
			this.DataList.Set("updateState", `v${status.Version ?? ""} 준비됨 — 재시작으로 적용`);
		else if (status.State === "downloading")
			this.DataList.Set("updateState", status.Percent !== undefined ? `받는 중 ${status.Percent}%` : "받는 중…");
		else if (status.State === "checking")
			this.DataList.Set("updateState", "확인 중…");
		else if (status.State === "error")
			this.DataList.Set("updateState", `오류: ${status.Message ?? ""}`);
		else
			this.DataList.Set("updateState", "");
	}
}
