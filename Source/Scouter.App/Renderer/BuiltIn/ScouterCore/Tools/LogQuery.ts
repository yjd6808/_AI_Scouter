/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: LogQuery Tool. 버퍼 조회.
*/

import type { ITool } from "@scouter/plugin-api";
import { Log } from "../../../Services/Log";

export class LogQueryTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "LogQuery";
	public readonly Description = "로그 버퍼를 조회한다.";
	public readonly InputSchema = { type: "object", properties: { Level: { type: "string" }, Scope: { type: "string" }, Since: { type: "number" }, Text: { type: "string" }, Limit: { type: "number" } } };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// LogBuffer.Query 경유.
	// @param _args: 인자
	public Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const level = _args["Level"];
		if (level !== undefined && level !== "debug" && level !== "info" && level !== "warn" && level !== "error")
			return Promise.reject(new Error("Level 범위 밖"));
		const scope = _args["Scope"];
		const since = _args["Since"];
		const text = _args["Text"];
		const limit = _args["Limit"];
		const filter: { Level?: "debug" | "info" | "warn" | "error"; Scope?: string; Since?: number; Text?: string; Limit?: number } = {};
		if (level !== undefined)
			filter.Level = level;
		if (typeof scope === "string")
			filter.Scope = scope;
		if (typeof since === "number")
			filter.Since = since;
		if (typeof text === "string")
			filter.Text = text;
		filter.Limit = typeof limit === "number" ? limit : 200;
		return Promise.resolve(Log.Buffer.Query(filter));
	}
}
