/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: IpcWindowChrome. Gui IWindowChrome을 IPC로 구현한다.
*/

import { SimpleEvent } from "@scouter/gui";
import type { IWindowChrome } from "@scouter/gui";
import { Ipc } from "../Services/Ipc";
import { IpcChannels } from "../../Shared/IpcChannels";

export class IpcWindowChrome implements IWindowChrome
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 최대화·고정 변경 수신을 건다.
	public constructor()
	{
		Ipc.On("window:maximized-changed", (..._args) =>
		{
			this.MaximizedChanged.Invoke(_args[0] as boolean);
		});
		Ipc.On(IpcChannels.WindowTopmostChanged, (..._args) =>
		{
			this.TopmostChanged.Invoke(_args[0] as boolean);
		});
	}

	// ==================== 이벤트 ====================
	public readonly MaximizedChanged = new SimpleEvent<boolean>();
	public readonly TopmostChanged = new SimpleEvent<boolean>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 최소화한다.
	public Minimize(): void
	{
		void Ipc.Invoke("window:minimize");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 최대화 토글한다.
	public ToggleMaximize(): void
	{
		void Ipc.Invoke("window:maximize-toggle");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫는다. 트레이 숨김 여부는 Main의 close 핸들러가 App.CloseToTray로 정한다.
	// 여기서 분기하면 Alt+F4 같은 OS 닫기와 규칙이 갈리므로 판단을 Main 한 곳에 모은다.
	public Close(): void
	{
		void Ipc.Invoke(IpcChannels.WindowClose);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 최대화 여부를 묻는다.
	public async IsMaximized(): Promise<boolean>
	{
		return (await Ipc.Invoke<boolean>("window:is-maximized")) ?? false;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항상 위를 뒤집고 결과를 반환한다.
	public async ToggleTopmost(): Promise<boolean>
	{
		return (await Ipc.Invoke<boolean>(IpcChannels.WindowToggleTopmost)) ?? false;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항상 위 여부를 묻는다.
	public async IsTopmost(): Promise<boolean>
	{
		return (await Ipc.Invoke<boolean>(IpcChannels.WindowIsTopmost)) ?? false;
	}
}
