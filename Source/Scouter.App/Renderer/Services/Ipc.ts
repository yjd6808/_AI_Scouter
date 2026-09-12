/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Ipc typed wrapper. electron.ipcRenderer 직접 호출을 한 곳에 모은다.
*/

import type { IDisposable } from "@scouter/gui";

interface IIpcRenderer
{
	invoke(_channel: string, ..._args: unknown[]): Promise<unknown>;
	send(_channel: string, ..._args: unknown[]): void;
	on(_channel: string, _listener: (..._args: unknown[]) => void): void;
	removeListener(_channel: string, _listener: (..._args: unknown[]) => void): void;
}

function Renderer(): IIpcRenderer | null
{
	try
	{
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const electron = require("electron") as { ipcRenderer?: IIpcRenderer };
		return electron.ipcRenderer ?? null;
	}
	catch
	{
		return null;
	}
}

export class Ipc
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// invoke 왕복 호출. Main 없으면 null.
	// @param _channel: 채널
	// @param _args: 인자
	public static async Invoke<T>(_channel: string, ..._args: unknown[]): Promise<T | null>
	{
		const renderer = Renderer();
		if (renderer === null)
			return null;
		return (await renderer.invoke(_channel, ..._args)) as T;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 단방향 전송.
	// @param _channel: 채널
	// @param _args: 인자
	public static Send(_channel: string, ..._args: unknown[]): void
	{
		Renderer()?.send(_channel, ..._args);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 수신 구독.
	// @param _channel: 채널
	// @param _handler: 핸들러
	public static On(_channel: string, _handler: (..._args: unknown[]) => void): IDisposable
	{
		const renderer = Renderer();
		renderer?.on(_channel, _handler);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				renderer?.removeListener(_channel, _handler);
			},
		};
	}
}
