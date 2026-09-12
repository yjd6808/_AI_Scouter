/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginReload Tool. 다시 읽기.
*/

import type { ITool } from "@scouter/plugin-api";
import { PluginManager } from "../../../Plugin/PluginManager";

export class PluginReloadTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "PluginReload";
	public readonly Description = "플러그인을 다시 읽는다.";
	public readonly InputSchema = { type: "object", properties: { Id: { type: "string" } }, required: ["Id"] };
	public readonly DefaultApproval = "ask" as const;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Reload 후 상태를 반환한다.
	// @param _args: 인자
	public async Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const id = _args["Id"];
		if (typeof id !== "string")
			throw new Error("Id required");
		if (!PluginManager.Has(id))
			throw new Error(`unknown plugin: ${id}`);
		await PluginManager.ReloadAsync(id);
		return PluginManager.Get(id);
	}
}
