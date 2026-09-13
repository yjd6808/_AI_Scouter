/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Shutdown. Main 종료 요청에 MCP를 멈추고 응답한다.
*/

import { Ipc } from "./Ipc";
import { Settings } from "./Settings";
import { McpHttpServer } from "../Mcp/McpHttpServer";
import { IpcChannels } from "../../Shared/IpcChannels";

export class Shutdown
{
	// ==================== 정적 ====================
	private static s_armed_ = false;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 종료 통지를 구독한다. 중복 호출 안전.
	public static Arm(): void
	{
		if (Shutdown.s_armed_)
			return;
		Shutdown.s_armed_ = true;
		Ipc.On(IpcChannels.AppBeforeQuit, () =>
		{
			void Settings.FlushAsync().finally(() =>
			{
				void McpHttpServer.StopForTestAsync().finally(() =>
				{
					Ipc.Send(IpcChannels.AppQuitReady);
				});
			});
		});
	}
}
