/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeLint Tool. 테마 JSON 검사.
*/

import type { ITool } from "@scouter/plugin-api";
import { ThemeLoader } from "../../../Theme/ThemeLoader";
import { ThemeLint } from "@scouter/gui";

export class ThemeLintTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ThemeLint";
	public readonly Description = "테마 JSON을 검사한다.";
	public readonly InputSchema = { type: "object", properties: { Json: { type: "string" } }, required: ["Json"] };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// JSON 문자열을 검사한다.
	// @param _args: 인자
	public Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const raw = _args["Json"];
		if (typeof raw !== "string")
			return Promise.reject(new Error("Json required"));
		let json: unknown;
		try
		{
			json = JSON.parse(raw);
		}
		catch
		{
			return Promise.reject(new Error("JSON 파싱 실패"));
		}
		const obj = json as { name?: string; defs?: Record<string, string>; theme?: Record<string, { dark?: string; light?: string }> };
		const parsed = ThemeLoader.Parse(obj.name ?? "lint", { name: obj.name ?? "lint", defs: obj.defs ?? {}, theme: obj.theme ?? {} }, "User");
		return Promise.resolve(ThemeLint.Run(parsed));
	}
}
