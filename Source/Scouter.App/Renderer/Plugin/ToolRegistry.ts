/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ToolRegistry. {PluginId}__{Tool} 등록소.
*/

import { SimpleEvent } from "@scouter/gui";
import type { IDisposable } from "@scouter/gui";
import type { ITool } from "@scouter/plugin-api";

export interface IRegisteredTool
{
	FullName: string;
	PluginId: string;
	Tool: ITool;
}

export class ToolRegistry
{
	// ==================== 정적 ====================
	private static readonly s_tools_ = new Map<string, IRegisteredTool>();
	private static readonly s_changed_ = new SimpleEvent<void>();

	// ==================== 속성 ====================
	public static get Changed(): SimpleEvent<void> { return ToolRegistry.s_changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool을 등록한다. 선언·등록 불일치는 호출자가 경고.
	// @param _pluginId: Plugin Id
	// @param _tool: Tool
	public static Register(_pluginId: string, _tool: ITool): IDisposable
	{
		const full = `${_pluginId}__${_tool.Name}`;
		ToolRegistry.s_tools_.set(full, { FullName: full, PluginId: _pluginId, Tool: _tool });
		ToolRegistry.s_changed_.Invoke(undefined);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				if (ToolRegistry.s_tools_.get(full)?.Tool === _tool)
					ToolRegistry.s_tools_.delete(full);
				ToolRegistry.s_changed_.Invoke(undefined);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 목록을 반환한다.
	public static List(): IRegisteredTool[]
	{
		return [...ToolRegistry.s_tools_.values()];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전체 이름으로 찾는다.
	// @param _fullName: {PluginId}__{Tool}
	public static Find(_fullName: string): IRegisteredTool | null
	{
		return ToolRegistry.s_tools_.get(_fullName) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin 도구를 일괄 제거한다. Deactivate용.
	// @param _pluginId: Plugin Id
	public static RemoveAll(_pluginId: string): void
	{
		let changed = false;
		for (const [full, reg] of [...ToolRegistry.s_tools_])
		{
			if (reg.PluginId === _pluginId)
			{
				ToolRegistry.s_tools_.delete(full);
				changed = true;
			}
		}
		if (changed)
			ToolRegistry.s_changed_.Invoke(undefined);
	}
}
