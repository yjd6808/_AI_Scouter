/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeSet Tool. 테마 적용.
*/

import type { ITool } from "@scouter/plugin-api";
import { ThemeManager } from "../../../Theme/ThemeManager";
import { Settings } from "../../../Services/Settings";

export class ThemeSetTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ThemeSet";
	public readonly Description = "테마를 적용한다.";
	public readonly InputSchema = { type: "object", properties: { Id: { type: "string" } }, required: ["Id"] };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Settings 경유로 적용한다.
	// @param _args: 인자
	public Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const id = _args["Id"];
		if (typeof id !== "string" || !ThemeManager.Set(id))
			return Promise.reject(new Error(`unknown theme: ${String(id)}`));
		Settings.Set("Theme.Id", id);
		return Promise.resolve({ Ok: true });
	}
}
