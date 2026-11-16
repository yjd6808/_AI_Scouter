/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Shutdown. Main 종료 요청에 설정·Plugin 저장소를 쓰고 MCP를 멈춘 뒤 응답한다.
*/

import { Ipc } from "./Ipc";
import { Settings } from "./Settings";
import { McpHttpServer } from "../Mcp/McpHttpServer";
import { PluginManager } from "../Plugin/PluginManager";
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
			// Plugin storage.json도 함께 쓴다. 디바운스(300ms) 안의 변경이 종료로 사라지지 않게 한다.
			void Promise.all([Settings.FlushAsync(), PluginManager.FlushStoragesAsync()]).finally(() =>
			{
				void McpHttpServer.StopForTestAsync().finally(() =>
				{
					Ipc.Send(IpcChannels.AppQuitReady);
				});
			});
		});
	}
}
