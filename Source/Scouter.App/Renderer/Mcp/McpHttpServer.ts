/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: McpHttpServer. node:http + Router. P0 골격 + P7 /mcp·/health.
*/
/* eslint-disable @typescript-eslint/no-deprecated -- D-19: 동적 Tool 목록에 저수준 Server 필요 */

import * as http from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { SimpleEvent } from "@scouter/gui";
import { Router } from "./Router";
import { Log } from "../Services/Log";
import { Settings } from "../Services/Settings";
import { Args } from "../Services/Args";
import { Auth } from "./Auth";
import { SessionManager } from "./SessionManager";
import type { ISession } from "./SessionManager";
import { McpCore } from "./McpCore";
import { AuditLog } from "./AuditLog";
import { ToolRegistry } from "../Plugin/ToolRegistry";
import { UpstreamProxy } from "./UpstreamProxy";
import type { IUpstreamDef } from "./UpstreamProxy";

const kMaxBodyBytes = 4 * 1024 * 1024;

export class McpHttpServer
{
	// ==================== 정적 ====================
	private static s_server_: http.Server | null = null;
	private static s_router_ = new Router();
	private static s_port_ = 9515;
	private static s_auth_: Auth | null = null;
	private static readonly s_sessions_ = new SessionManager();
	private static readonly s_sessionsChanged_ = new SimpleEvent<void>();
	private static s_mcpAttached_ = false;

	// ==================== 속성 ====================
	public static get Router(): Router { return McpHttpServer.s_router_; }
	public static get Port(): number { return McpHttpServer.s_port_; }
	public static get Auth(): Auth | null { return McpHttpServer.s_auth_; }
	public static get SessionsChanged(): SimpleEvent<void> { return McpHttpServer.s_sessionsChanged_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 서버를 시작한다. 포트 충돌 시 +1씩 5회 재시도한다.
	// @param _port: 희망 포트
	public static async StartAsync(_port: number): Promise<number>
	{
		if (McpHttpServer.s_server_ !== null)
			return McpHttpServer.s_port_;
		for (let attempt = 0; attempt < 5; ++attempt)
		{
			const port = _port + attempt;
			try
			{
				await McpHttpServer.ListenOnceAsync(port);
				McpHttpServer.s_port_ = port;
				Log.Info("Mcp", `listening ${port}`);
				console.log(`SCOUTER_TEST_PORT=${port}`);
				return port;
			}
			catch
			{
				continue;
			}
		}
		throw new Error("[McpHttpServer] 포트 5회 재시도 실패");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// /mcp·/health를 붙인다. Bootstrap 7단계.
	// @param _authDir: 토큰 폴더
	// @param _upstreams: 업스트림 정의
	public static async AttachMcpAsync(_authDir: string, _upstreams: IUpstreamDef[]): Promise<void>
	{
		if (McpHttpServer.s_mcpAttached_)
			return;
		McpHttpServer.s_mcpAttached_ = true;
		const auth = new Auth(_authDir);
		await auth.InitAsync();
		McpHttpServer.s_auth_ = auth;
		McpHttpServer.s_router_.Add("GET", "/health", (_req, _res) =>
		{
			_res.statusCode = 200;
			_res.setHeader("content-type", "application/json");
			_res.end(JSON.stringify({ Ok: true, Version: "0.4.0", Sessions: McpHttpServer.s_sessions_.List().length, Tools: ToolRegistry.List().length }));
		});
		McpHttpServer.s_router_.Add("POST", "/mcp", (_req, _res) => void McpHttpServer.HandleMcpAsync(_req, _res));
		McpHttpServer.s_router_.Add("GET", "/mcp", (_req, _res) => void McpHttpServer.HandleMcpAsync(_req, _res));
		McpHttpServer.s_router_.Add("DELETE", "/mcp", (_req, _res) => void McpHttpServer.HandleMcpAsync(_req, _res));
		McpHttpServer.s_sessions_.Start(Settings.Get<number>("Mcp.SessionIdleMinutes", 30));
		McpHttpServer.s_sessions_.Changed.Add(() =>
		{
			McpHttpServer.s_sessionsChanged_.Invoke(undefined);
		});
		const notifyAll = (): void =>
		{
			for (const info of McpHttpServer.s_sessions_.List())
			{
				const session = McpHttpServer.s_sessions_.Get(info.Id);
				if (session !== null)
					void session.Server.sendToolListChanged().catch(() => undefined);
			}
		};
		ToolRegistry.Changed.Add(() =>
		{
			notifyAll();
		});
		AuditLog.Init(`${_authDir}/logs`, Settings.Get<number>("Mcp.AuditMaxMb", 20));
		await UpstreamProxy.ConnectAllAsync(_upstreams);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 세션 목록을 반환한다. 상태바·Inspector용.
	public static SessionList(): Array<{ Id: string; Client: string; CreatedAt: number; LastSeen: number; CallCount: number }>
	{
		return McpHttpServer.s_sessions_.List();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 세션을 끊는다. Inspector 종료 버튼용.
	// @param _id: 세션 Id
	public static async CloseSessionAsync(_id: string): Promise<void>
	{
		await McpHttpServer.s_sessions_.RemoveAsync(_id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 서버를 멈춘다. 통합 테스트용.
	public static async StopForTestAsync(): Promise<void>
	{
		McpHttpServer.s_sessions_.Stop();
		await McpHttpServer.s_sessions_.CloseAllAsync();
		if (McpHttpServer.s_server_ !== null)
		{
			await new Promise<void>((_resolve) =>
			{
				McpHttpServer.s_server_?.close(() =>
				{
					_resolve();
				});
			});
			McpHttpServer.s_server_ = null;
		}
		McpHttpServer.s_mcpAttached_ = false;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰을 재발급하고 전 세션을 끊는다.
	public static async RegenerateTokenAsync(): Promise<string>
	{
		if (McpHttpServer.s_auth_ === null)
			throw new Error("[Mcp] 미초기화");
		const token = await McpHttpServer.s_auth_.RegenerateAsync();
		await McpHttpServer.s_sessions_.CloseAllAsync();
		return token;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 단일 포트 listen 1회 시도.
	// @param _port: 포트
	private static ListenOnceAsync(_port: number): Promise<void>
	{
		return new Promise((_resolve, _reject) =>
		{
			const server = http.createServer((_req, _res) =>
			{
				void McpHttpServer.s_router_.Dispatch(_req, _res).then((_matched) =>
				{
					if (!_matched)
					{
						_res.statusCode = 404;
						_res.end("{}");
					}
				});
			});
			server.on("error", _reject);
			server.listen(_port, "127.0.0.1", () =>
			{
				McpHttpServer.s_server_ = server;
				_resolve();
			});
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// /mcp 분기. 인증→세션→sdk 위임.
	// @param _req: 요청
	// @param _res: 응답
	private static async HandleMcpAsync(_req: http.IncomingMessage, _res: http.ServerResponse): Promise<void>
	{
		const auth = McpHttpServer.s_auth_;
		if (auth !== null && !auth.Verify(_req, Args.NoAuth))
		{
			_res.statusCode = 401;
			_res.end(JSON.stringify({ error: "unauthorized" }));
			return;
		}
		const origin = _req.headers.origin;
		if (origin !== undefined && !Settings.Get<string[]>("Mcp.AllowedOrigins", []).includes(origin))
		{
			_res.statusCode = 403;
			_res.end(JSON.stringify({ error: "origin not allowed" }));
			return;
		}
		const sessionId = _req.headers["mcp-session-id"] as string | undefined;
		const body = _req.method === "POST" ? await McpHttpServer.ReadJsonAsync(_req) : undefined;
		const session = sessionId !== undefined ? McpHttpServer.s_sessions_.Get(sessionId) : null;
		if (session === null && _req.method === "POST" && McpHttpServer.IsInitialize(body))
		{
			const box: { Current: ISession | null } = { Current: null };
			const transport = new StreamableHTTPServerTransport({
				sessionIdGenerator: () => randomUUID(),
				onsessioninitialized: (_id) =>
				{
					const params = (body as { params?: { clientInfo?: { name?: string } } } | undefined)?.params;
					const client = params?.clientInfo?.name ?? "unknown";
					box.Current = McpHttpServer.s_sessions_.Create(_id, transport, server, client);
				},
			});
			const server: Server = McpCore.Create(() => box.Current);
			await server.connect(transport as unknown as Transport);
			await transport.handleRequest(_req, _res, body);
			return;
		}
		if (session === null)
		{
			_res.statusCode = 404;
			_res.end(JSON.stringify({ error: "unknown session" }));
			return;
		}
		try
		{
			await session.Transport.handleRequest(_req, _res, body);
		}
		catch
		{
			if (!_res.writableEnded)
			{
				_res.statusCode = 500;
				_res.end("{}");
			}
		}
		if (_req.method === "DELETE")
			await McpHttpServer.s_sessions_.RemoveAsync(session.Id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// initialize 요청인지 본다.
	// @param _body: 본문
	private static IsInitialize(_body: unknown): boolean
	{
		if (typeof _body !== "object" || _body === null)
			return false;
		return (_body as { method?: unknown }).method === "initialize";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 본문을 읽는다. 4MB 초과면 빈 객체.
	// @param _req: 요청
	private static ReadJsonAsync(_req: http.IncomingMessage): Promise<unknown>
	{
		return new Promise((_resolve) =>
		{
			const chunks: Buffer[] = [];
			let size = 0;
			_req.on("data", (_chunk: Buffer) =>
			{
				size += _chunk.length;
				if (size <= kMaxBodyBytes)
					chunks.push(_chunk);
			});
			_req.on("end", () =>
			{
				try
				{
					_resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")) as unknown);
				}
				catch
				{
					_resolve(undefined);
				}
			});
			_req.on("error", () =>
			{
				_resolve(undefined);
			});
		});
	}
}
