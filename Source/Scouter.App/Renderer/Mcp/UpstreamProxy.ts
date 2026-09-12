/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UpstreamProxy. 외부 MCP를 Prefix__Tool로 재노출. 승인도 같이 적용.
*/

import type { ChildProcess } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ToolRegistry } from "../Plugin/ToolRegistry";
import type { IDisposable } from "@scouter/gui";
import { Log } from "../Services/Log";

export interface IUpstreamDef
{
	Name: string;
	Transport: "stdio" | "http";
	Command?: string;
	Args?: string[];
	Url?: string;
	Headers?: Record<string, string>;
	Prefix: string;
}

interface IUpstreamState
{
	Def: IUpstreamDef;
	Client: Client | null;
	Child: ChildProcess | null;
	Regs: IDisposable[];
	Fails: number;
	Timer: ReturnType<typeof setTimeout> | null;
}

export class UpstreamProxy
{
	// ==================== 정적 ====================
	private static readonly s_states_ = new Map<string, IUpstreamState>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 정의를 전부 연결한다.
	// @param _defs: 정의 목록
	public static ConnectAllAsync(_defs: IUpstreamDef[]): Promise<void>
	{
		void Promise.all(_defs.map((_def) => UpstreamProxy.ConnectOne(_def)));
		return Promise.resolve();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 연결을 끊는다. 종료 시 호출.
	public static async DisconnectAllAsync(): Promise<void>
	{
		for (const [name, state] of [...UpstreamProxy.s_states_])
		{
			if (state.Timer !== null)
				clearTimeout(state.Timer);
			for (const reg of state.Regs)
				reg.Dispose();
			try
			{
				await state.Client?.close();
			}
			catch
			{
				// 무시.
			}
			state.Child?.kill();
			UpstreamProxy.s_states_.delete(name);
		}
		ToolRegistry.RemoveAll("__upstream__");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 1개를 연결한다. 실패하면 백오프 재시도 5회.
	// @param _def: 정의
	private static async ConnectOne(_def: IUpstreamDef): Promise<void>
	{
		const state: IUpstreamState = { Def: _def, Client: null, Child: null, Regs: [], Fails: 0, Timer: null };
		UpstreamProxy.s_states_.set(_def.Name, state);
		for (let attempt = 0; attempt < 6; ++attempt)
		{
			try
			{
				await UpstreamProxy.DialAsync(state);
				state.Fails = 0;
				return;
			}
			catch
			{
				state.Fails++;
				Log.Warn("Mcp", `upstream 재시도: ${_def.Name} (${state.Fails})`);
				await new Promise((_resolve) => setTimeout(_resolve, [1000, 2000, 4000, 8000, 8000][Math.min(attempt, 4)] as number));
			}
		}
		Log.Error("Mcp", `upstream 포기: ${_def.Name}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전송 연결 + Tool 재등록.
	// @param _state: 상태
	private static async DialAsync(_state: IUpstreamState): Promise<void>
	{
		const def = _state.Def;
		const transport = def.Transport === "stdio"
			? new StdioClientTransport({ command: def.Command ?? "", args: def.Args ?? [] })
			: new StreamableHTTPClientTransport(new URL(def.Url ?? ""), { requestInit: { headers: def.Headers ?? {} } });
		const client = new Client({ name: "scouter-upstream", version: "0.4.0" }, { capabilities: {} });
		await client.connect(transport as unknown as Transport);
		_state.Client = client;
		const listed = await client.listTools();
		for (const reg of _state.Regs)
			reg.Dispose();
		_state.Regs = [];
		for (const tool of listed.tools)
		{
			const toolName = tool.name;
			const reg = ToolRegistry.Register("__upstream__", {
				Name: `${def.Prefix}__${toolName}`,
				Description: tool.description ?? toolName,
				InputSchema: tool.inputSchema,
				Run: (_args) => UpstreamProxy.CallAsync(def, client, toolName, _args),
			});
			_state.Regs.push(reg);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 외부 Tool을 호출한다. 결과를 JSON으로 푼다.
	// @param _def: 정의
	// @param _client: 클라이언트
	// @param _name: Tool 이름
	// @param _args: 인자
	private static async CallAsync(_def: IUpstreamDef, _client: Client, _name: string, _args: Record<string, unknown>): Promise<unknown>
	{
		const result = await _client.callTool({ name: _name, arguments: _args });
		const blocks = (result.content ?? []) as Array<{ type: string; text?: string }>;
		return { Content: blocks.map((_b) => ({ Type: "text" as const, Text: _b.text ?? JSON.stringify(_b) })) };
	}
}
