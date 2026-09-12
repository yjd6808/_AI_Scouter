/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: IpcWindowChrome. Gui IWindowChrome을 IPC로 구현한다.
*/

import { SimpleEvent } from "@scouter/gui";
import type { IWindowChrome } from "@scouter/gui";
import { Ipc } from "../Services/Ipc";

export class IpcWindowChrome implements IWindowChrome
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 최대화 변경 수신을 건다.
	public constructor()
	{
		Ipc.On("window:maximized-changed", (..._args) =>
		{
			this.MaximizedChanged.Invoke(_args[0] as boolean);
		});
	}

	// ==================== 이벤트 ====================
	public readonly MaximizedChanged = new SimpleEvent<boolean>();

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
	// 닫는다.
	public Close(): void
	{
		void Ipc.Invoke("window:close");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 최대화 여부를 묻는다.
	public async IsMaximized(): Promise<boolean>
	{
		return (await Ipc.Invoke<boolean>("window:is-maximized")) ?? false;
	}
}
