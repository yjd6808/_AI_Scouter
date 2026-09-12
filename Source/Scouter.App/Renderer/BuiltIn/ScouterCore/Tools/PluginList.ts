/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginList Tool. 플러그인 상태 목록.
*/

import type { ITool } from "@scouter/plugin-api";
import { PluginManager } from "../../../Plugin/PluginManager";

export class PluginListTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "PluginList";
	public readonly Description = "플러그인 목록/상태/신뢰.";
	public readonly InputSchema = { type: "object", properties: {} };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록을 반환한다.
	public Run(): Promise<unknown>
	{
		return Promise.resolve(PluginManager.List());
	}
}
