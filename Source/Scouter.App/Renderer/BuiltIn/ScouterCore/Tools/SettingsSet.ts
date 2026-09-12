/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SettingsSet Tool. 검증 저장 + 재시작 필요 표시.
*/

import type { ITool } from "@scouter/plugin-api";
import { Settings } from "../../../Services/Settings";

export class SettingsSetTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "SettingsSet";
	public readonly Description = "설정 값을 쓴다. 재시작 필요 키는 RequiresRestart.";
	public readonly InputSchema = { type: "object", properties: { Path: { type: "string" }, Value: {} }, required: ["Path", "Value"] };
	public readonly DefaultApproval = "ask" as const;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 검증 후 저장. Mcp.Port 등은 재시작 필요.
	// @param _args: 인자
	public Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const path = _args["Path"];
		if (typeof path !== "string")
			return Promise.reject(new Error("Path required"));
		try
		{
			Settings.Set(path, _args["Value"]);
		}
		catch (_e)
		{
			return Promise.reject(_e instanceof Error ? _e : new Error(String(_e)));
		}
		return Promise.resolve({ Ok: true, RequiresRestart: path === "Mcp.Port" || path === "Mcp.Enabled" || path === "Ui.NativeFrame" });
	}
}
