/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: McpCore. 세션별 sdk Server + 8 핸들러. 목록은 매 요청 동적.
*/
/* eslint-disable @typescript-eslint/no-deprecated -- D-19: 동적 Tool 목록에 저수준 Server 필요 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema,
	ListPromptsRequestSchema, GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ToolRegistry } from "../Plugin/ToolRegistry";
import { ResourceRegistry } from "../Plugin/ResourceRegistry";
import { PromptRegistry } from "../Plugin/PromptRegistry";
import { ToolInvoker } from "./ToolInvoker";
import type { ISession } from "./SessionManager";

export class McpCore
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 세션용 sdk Server를 만든다. 핸들러는 호출 시점에 읽기.
	// @param _getSession: 세션 조회기
	public static Create(_getSession: () => ISession | null): Server
	{
		const server = new Server(
			{ name: "scouter", version: "0.4.0" },
			{ capabilities: { tools: { listChanged: true }, resources: { listChanged: true }, prompts: { listChanged: true } } },
		);
		server.setRequestHandler(ListToolsRequestSchema, () => Promise.resolve({
			tools: ToolRegistry.List().map((_t) => ({
				name: _t.FullName,
				description: _t.Tool.Description,
				inputSchema: { type: "object", ..._t.Tool.InputSchema },
				annotations: {
					title: _t.Tool.Description,
					readOnlyHint: _t.Tool.Annotations?.ReadOnly,
					destructiveHint: _t.Tool.Annotations?.Destructive,
				},
			})),
		}));
		server.setRequestHandler(CallToolRequestSchema, async (_req, _extra) =>
		{
			const session = _getSession();
			if (session === null)
				throw new Error("unknown session");
			const args = _req.params.arguments ?? {};
			const token = (_req.params._meta as { progressToken?: string | number } | undefined)?.progressToken;
			const result = await ToolInvoker.InvokeAsync(
				_req.params.name,
				args,
				session,
				(_n, _msg) =>
				{
					if (token !== undefined)
					{
						void _extra.sendNotification({
							method: "notifications/progress",
							params: { progressToken: token, progress: _n, message: _msg },
						});
					}
				},
				_extra.signal,
			);
			return { content: result.Content, isError: result.IsError };
		});
		server.setRequestHandler(ListResourcesRequestSchema, () => Promise.resolve({
			resources: ResourceRegistry.List().map((_r) => ({ uri: _r.Uri, name: _r.Uri, mimeType: _r.MimeType })),
		}));
		server.setRequestHandler(ReadResourceRequestSchema, (_req) => Promise.resolve((() =>
		{
			const found = ResourceRegistry.List().find((_r) => _r.Uri === _req.params.uri);
			if (found === undefined)
				throw new Error(`unknown resource: ${_req.params.uri}`);
			if (found.MimeType.startsWith("text/") || found.MimeType.includes("json") || found.MimeType.includes("markdown"))
				return { contents: [{ uri: found.Uri, mimeType: found.MimeType, text: found.Text }] };
			return { contents: [{ uri: found.Uri, mimeType: found.MimeType, blob: found.Text }] };
		})()));
		server.setRequestHandler(ListPromptsRequestSchema, () => Promise.resolve({
			prompts: PromptRegistry.List().map((_p) => ({ name: _p.Name, description: _p.Description })),
		}));
		server.setRequestHandler(GetPromptRequestSchema, (_req) => Promise.resolve((() =>
		{
			const found = PromptRegistry.List().find((_p) => _p.Name === _req.params.name);
			if (found === undefined)
				throw new Error(`unknown prompt: ${_req.params.name}`);
			const text = found.Build(_req.params.arguments ?? {});
			return { description: found.Description, messages: [{ role: "user", content: { type: "text", text } }] };
		})()));
		return server;
	}
}
