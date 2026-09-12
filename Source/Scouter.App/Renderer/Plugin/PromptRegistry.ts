/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PromptRegistry. MakePlugin류 프롬프트 등록소.
*/

import type { IDisposable } from "@scouter/gui";

export interface IPromptEntry
{
	Name: string;
	PluginId: string;
	Description: string;
	Build: (_args: Record<string, unknown>) => string;
}

export class PromptRegistry
{
	// ==================== 정적 ====================
	private static readonly s_items_ = new Map<string, IPromptEntry>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 프롬프트를 등록한다.
	// @param _pluginId: Plugin Id
	// @param _name: 이름
	// @param _description: 설명
	// @param _build: 생성기
	public static Register(_pluginId: string, _name: string, _description: string, _build: (_args: Record<string, unknown>) => string): IDisposable
	{
		const full = `${_pluginId}.${_name}`;
		PromptRegistry.s_items_.set(full, { Name: full, PluginId: _pluginId, Description: _description, Build: _build });
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				PromptRegistry.s_items_.delete(full);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 목록을 반환한다.
	public static List(): IPromptEntry[]
	{
		return [...PromptRegistry.s_items_.values()];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin entries를 일괄 제거한다.
	// @param _pluginId: Plugin Id
	public static RemoveAll(_pluginId: string): void
	{
		for (const [name, entry] of [...PromptRegistry.s_items_])
		{
			if (entry.PluginId === _pluginId)
				PromptRegistry.s_items_.delete(name);
		}
	}
}
