/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ConnectSnippet Tool. 클라이언트별 접속 JSON.
*/

import type { ITool } from "@scouter/plugin-api";
import { ConnectSnippets } from "../ConnectSnippets";
import { McpHttpServer } from "../../../Mcp/McpHttpServer";

export class ConnectSnippetTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ConnectSnippet";
	public readonly Description = "클라이언트별 MCP 접속 스니펫.";
	public readonly InputSchema = { type: "object", properties: { Client: { type: "string" } }, required: ["Client"] };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 포트·토큰으로 렌더한다.
	// @param _args: 인자
	public async Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const client = _args["Client"];
		if (typeof client !== "string")
			throw new Error("Client required");
		const auth = McpHttpServer.Auth;
		if (auth === null)
			throw new Error("MCP 미시작");
		const url = `http://127.0.0.1:${McpHttpServer.Port}`;
		return ConnectSnippets.Render(client, url, auth.Token);
	}
}
