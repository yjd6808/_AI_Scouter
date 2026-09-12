/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CommandList Tool. 호스트 명령 목록.
*/

import type { ITool } from "@scouter/plugin-api";
import { CommandRegistry } from "../../../Services/CommandRegistry";

export class CommandListTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "CommandList";
	public readonly Description = "호스트 명령 목록.";
	public readonly InputSchema = { type: "object", properties: { Prefix: { type: "string" } } };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Prefix 필터 목록을 반환한다.
	// @param _args: 인자
	public Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const prefix = _args["Prefix"];
		const names = CommandRegistry.List().map((_c) => ({ Name: _c.Id, Title: _c.Title, Hotkey: _c.Hotkey ?? "" }));
		if (typeof prefix === "string" && prefix.length > 0)
			return Promise.resolve(names.filter((_n) => _n.Name.startsWith(prefix)));
		return Promise.resolve(names);
	}
}
