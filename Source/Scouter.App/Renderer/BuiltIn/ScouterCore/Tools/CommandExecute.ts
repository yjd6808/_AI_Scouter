/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CommandExecute Tool. 호스트 명령 실행.
*/

import type { ITool } from "@scouter/plugin-api";
import { CommandRegistry } from "../../../Services/CommandRegistry";

export class CommandExecuteTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "CommandExecute";
	public readonly Description = "호스트 명령을 실행한다.";
	public readonly InputSchema = { type: "object", properties: { Name: { type: "string" }, Args: { type: "object" } }, required: ["Name"] };
	public readonly DefaultApproval = "ask" as const;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// HostCommands 경유 실행.
	// @param _args: 인자
	public async Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const name = _args["Name"];
		if (typeof name !== "string")
			throw new Error("Name required");
		if (!CommandRegistry.CanExecute(name))
			throw new Error(`unknown command: ${name}`);
		const ok = await CommandRegistry.Execute(name, _args["Args"]);
		return { Ok: ok };
	}
}
