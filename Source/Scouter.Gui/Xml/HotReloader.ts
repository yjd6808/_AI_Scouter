/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: HotReloader. 파일 감시는 App이 주입(chokidar), 판단·재적재는 여기.
*/

import type { IDisposable } from "../Core/Disposable";
import type { ILayoutProvider } from "../Host/ILayoutProvider";
import { UIManager } from "../Host/UIManager";

export interface IFileWatcher
{
	Watch(_dirs: string[], _onChange: (_path: string) => void): IDisposable;
}

export class HotReloader
{
	// ==================== 정적 ====================
	private static s_watcher_: IDisposable | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 감시를 시작한다. 이미 돌면 교체.
	// @param _provider: 레이아웃 제공자
	// @param _watcher: 파일 감시자
	// @param _onToast: 알림 콜백
	public static Start(_provider: ILayoutProvider, _watcher: IFileWatcher, _onToast: (_msg: string, _isError: boolean) => void): void
	{
		HotReloader.Stop();
		HotReloader.s_watcher_ = _watcher.Watch(_provider.WatchDirs(), (_path) =>
		{
			void HotReloader.HandleChange(_provider, _path, _onToast);
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 감시를 멈춘다.
	public static Stop(): void
	{
		HotReloader.s_watcher_?.Dispose();
		HotReloader.s_watcher_ = null;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 변경 1건을 처리한다. 이름 해석→재적재→토스트.
	// @param _provider: 제공자
	// @param _path: 변경 경로
	// @param _onToast: 알림 콜백
	private static async HandleChange(_provider: ILayoutProvider, _path: string, _onToast: (_msg: string, _isError: boolean) => void): Promise<void>
	{
		const name = _provider.NameOf(_path);
		if (name === null)
			return;
		const ok = await UIManager.ReloadByLayout(name);
		_onToast(ok ? `${name} 다시 불러옴` : `${name} 재적재 실패`, !ok);
	}
}
