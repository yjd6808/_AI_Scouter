/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ChokidarWatcher. HotReloader에 chokidar를 꽂는다.
*/

import { watch } from "chokidar";
import type { FSWatcher } from "chokidar";
import type { IFileWatcher } from "@scouter/gui";
import type { IDisposable } from "@scouter/gui";

export class ChokidarWatcher implements IFileWatcher
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 폴더를 감시한다. 저장 안정화 80ms.
	// @param _dirs: 폴더 목록
	// @param _onChange: 변경 콜백
	public Watch(_dirs: string[], _onChange: (_path: string) => void): IDisposable
	{
		let watcher: FSWatcher | null = null;
		try
		{
			watcher = watch(_dirs, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 80 } });
			watcher.on("change", _onChange);
			watcher.on("add", _onChange);
		}
		catch
		{
			watcher = null;
		}
		let stopped = false;
		return {
			Dispose: () =>
			{
				if (stopped)
					return;
				stopped = true;
				void watcher?.close();
			},
		};
	}
}
