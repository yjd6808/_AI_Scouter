/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UpdateClient. Main 업데이트 상태를 Toast로 알린다.
*/

import { Ipc } from "./Ipc";
import { ToastService } from "@scouter/gui";
import { IpcChannels } from "../../Shared/IpcChannels";
import type { IUpdateStatus } from "../../Shared/IpcChannels";

export class UpdateClient
{
	// ==================== 정적 ====================
	private static s_started_ = false;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태 수신을 시작한다. 중복 호출 안전.
	public static Start(): void
	{
		if (UpdateClient.s_started_)
			return;
		UpdateClient.s_started_ = true;
		Ipc.On(IpcChannels.AppUpdateStatus, (..._args) =>
		{
			UpdateClient.OnStatus((_args[0] ?? {}) as IUpdateStatus);
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태별 Toast. 오류는 조용히 넘긴다(사내 서버 다운 소음 방지).
	// @param _status: 상태
	private static OnStatus(_status: IUpdateStatus): void
	{
		if (_status.State === "ready")
			ToastService.Success(`v${_status.Version ?? ""} 다운로드 완료 — 정보 창에서 재시작`);
		else if (_status.State === "downloading" && _status.Percent !== undefined)
			ToastService.Info(`업데이트 받는 중 ${_status.Percent}%`);
	}
}
