/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SettingsGet Tool. 시크릿 마스킹 읽기.
*/

import type { ITool } from "@scouter/plugin-api";
import { Settings } from "../../../Services/Settings";

export class SettingsGetTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "SettingsGet";
	public readonly Description = "설정 값을 읽는다. x-secret은 마스킹.";
	public readonly InputSchema = { type: "object", properties: { Path: { type: "string" } } };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Path 없으면 전체, 있으면 해당 값.
	// @param _args: 인자
	public Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const path = _args["Path"];
		if (typeof path !== "string" || path.length === 0)
			return Promise.resolve(SettingsSnapshot());
		if (path.toLowerCase().includes("secret") || path.toLowerCase().includes("token"))
			return Promise.resolve("(masked)");
		try
		{
			return Promise.resolve(Settings.Get<unknown>(path));
		}
		catch
		{
			return Promise.reject(new Error(`unknown settings path: ${path}`));
		}
	}
}

function SettingsSnapshot(): unknown
{
	const out: Record<string, unknown> = {};
	for (const group of ["Ui", "Theme", "App", "Mcp", "Log"])
	{
		try
		{
			out[group] = Settings.Get<unknown>(group);
		}
		catch
		{
			continue;
		}
	}
	return out;
}
