/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ResourceRegistry. scouter:// 리소스 등록소.
*/

import { SimpleEvent } from "@scouter/gui";
import type { IDisposable } from "@scouter/gui";

export interface IResourceEntry
{
	Uri: string;
	PluginId: string;
	Text: string;
	MimeType: string;
}

export class ResourceRegistry
{
	// ==================== 정적 ====================
	private static readonly s_items_ = new Map<string, IResourceEntry>();
	private static readonly s_changed_ = new SimpleEvent<void>();

	// ==================== 속성 ====================
	public static get Changed(): SimpleEvent<void> { return ResourceRegistry.s_changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 리소스를 등록한다.
	// @param _pluginId: Plugin Id
	// @param _uri: 상대 uri
	// @param _text: 내용
	// @param _mimeType: MIME
	public static Register(_pluginId: string, _uri: string, _text: string, _mimeType: string): IDisposable
	{
		const full = `scouter://${_pluginId}/${_uri}`;
		ResourceRegistry.s_items_.set(full, { Uri: full, PluginId: _pluginId, Text: _text, MimeType: _mimeType });
		ResourceRegistry.s_changed_.Invoke(undefined);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				ResourceRegistry.s_items_.delete(full);
				ResourceRegistry.s_changed_.Invoke(undefined);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 목록을 반환한다.
	public static List(): IResourceEntry[]
	{
		return [...ResourceRegistry.s_items_.values()];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin entries를 일괄 제거한다.
	// @param _pluginId: Plugin Id
	public static RemoveAll(_pluginId: string): void
	{
		let changed = false;
		for (const [uri, entry] of [...ResourceRegistry.s_items_])
		{
			if (entry.PluginId === _pluginId)
			{
				ResourceRegistry.s_items_.delete(uri);
				changed = true;
			}
		}
		if (changed)
			ResourceRegistry.s_changed_.Invoke(undefined);
	}
}
