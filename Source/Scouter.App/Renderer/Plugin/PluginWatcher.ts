/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginWatcher. ts/json/css는 재번들, xml은 핫리로드.
*/

import { watch } from "chokidar";
import type { FSWatcher } from "chokidar";
import { Log } from "../Services/Log";
import { PluginManager } from "./PluginManager";

export class PluginWatcher
{
	// ==================== 정적 ====================
	private static s_watcher_: FSWatcher | null = null;
	private static readonly s_pending_ = new Map<string, ReturnType<typeof setTimeout>>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 감시를 시작한다. 이미 돌면 교체.
	// @param _dirs: Plugin 폴더 목록
	public static Start(_dirs: string[]): void
	{
		PluginWatcher.Stop();
		try
		{
			PluginWatcher.s_watcher_ = watch(_dirs, { ignoreInitial: true, ignored: /\.cache/, awaitWriteFinish: { stabilityThreshold: 100 } });
			PluginWatcher.s_watcher_.on("change", (_file) =>
			{
				PluginWatcher.OnChange(_file);
			});
			PluginWatcher.s_watcher_.on("add", (_file) =>
			{
				PluginWatcher.OnChange(_file);
			});
		}
		catch
		{
			// 감시 실패는 무시.
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 감시를 멈춘다.
	public static Stop(): void
	{
		for (const timer of PluginWatcher.s_pending_.values())
			clearTimeout(timer);
		PluginWatcher.s_pending_.clear();
		void PluginWatcher.s_watcher_?.close();
		PluginWatcher.s_watcher_ = null;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 변경 1건을 디바운스 후 리로드한다.
	// @param _file: 변경 파일
	private static OnChange(_file: string): void
	{
		const id = PluginWatcher.IdOf(_file);
		if (id === null)
			return;
		const prev = PluginWatcher.s_pending_.get(id);
		if (prev !== undefined)
			clearTimeout(prev);
		PluginWatcher.s_pending_.set(id, setTimeout(() =>
		{
			PluginWatcher.s_pending_.delete(id);
			void PluginManager.ReloadAsync(id).then(
				() =>
				{
					Log.Info("Plugin", `${id} 핫리로드`);
				},
				() => undefined,
			);
		}, 300));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 경로에서 Plugin Id를 찾는다. 로드된 것만.
	// @param _file: 경로
	private static IdOf(_file: string): string | null
	{
		for (const info of PluginManager.List())
		{
			const handle = PluginManager.Get(info.Id);
			if (handle !== null && _file.startsWith(handle.Dir))
				return info.Id;
		}
		return null;
	}
}
