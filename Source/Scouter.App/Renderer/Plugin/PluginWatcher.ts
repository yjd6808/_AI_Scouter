/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginWatcher. xml은 자동 리로드, ts/json/css는 Dirty 표시 후 수동 리로드.
*/

import { watch } from "chokidar";
import type { FSWatcher } from "chokidar";
import { Log } from "../Services/Log";
import { PluginManager } from "./PluginManager";

export class PluginWatcher
{
	// ==================== 정적 ====================
	private static s_watcher_: FSWatcher | null = null;
	private static readonly s_pending_ = new Map<string, { Timer: ReturnType<typeof setTimeout>; Kind: "Reload" | "Dirty" }>();

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
		for (const pending of PluginWatcher.s_pending_.values())
			clearTimeout(pending.Timer);
		PluginWatcher.s_pending_.clear();
		void PluginWatcher.s_watcher_?.close();
		PluginWatcher.s_watcher_ = null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 종류별 동작을 정한다. xml만 자동 리로드, ts/json/css는 Dirty 표시.
	// @param _file: 변경 파일
	public static KindOf(_file: string): "Reload" | "Dirty" | "Ignore"
	{
		const lower = _file.toLowerCase();
		if (lower.endsWith(".xml"))
			return "Reload";
		if (lower.endsWith(".ts") || lower.endsWith(".json") || lower.endsWith(".css"))
			return "Dirty";
		return "Ignore";
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 변경 1건을 디바운스한다. xml은 리로드, 나머지는 Dirty 표시. 리로드가 우선.
	// @param _file: 변경 파일
	private static OnChange(_file: string): void
	{
		const id = PluginWatcher.IdOf(_file);
		if (id === null)
			return;
		const kind = PluginWatcher.KindOf(_file);
		if (kind === "Ignore")
			return;
		const prev = PluginWatcher.s_pending_.get(id);
		if (prev !== undefined)
			clearTimeout(prev.Timer);
		const merged = prev !== undefined && prev.Kind === "Reload" ? "Reload" : kind;
		PluginWatcher.s_pending_.set(id, {
			Timer: setTimeout(() =>
			{
				PluginWatcher.s_pending_.delete(id);
				if (merged === "Reload")
				{
					void PluginManager.ReloadAsync(id).then(
						() =>
						{
							Log.Info("Plugin", `${id} 핫리로드`);
						},
						() => undefined,
					);
				}
				else
				{
					PluginManager.MarkDirty(id);
					Log.Info("Plugin", `${id} 변경 감지(다시 로드 필요)`);
				}
			}, 300),
			Kind: merged,
		});
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
