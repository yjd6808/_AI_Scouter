/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MCP 통합. 실제 http + sdk Client로 initialize→list→call→종료.
*/

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import * as http from "node:http";
import { spawnSync } from "node:child_process";
import { McpHttpServer } from "../../Scouter.App/Renderer/Mcp/McpHttpServer";
import { ToolRegistry } from "../../Scouter.App/Renderer/Plugin/ToolRegistry";
import { ApprovalManager } from "../../Scouter.App/Renderer/Mcp/ApprovalManager";
import { Settings } from "../../Scouter.App/Renderer/Services/Settings";
import schema from "../../Scouter.App/Config/Settings.schema.json" with { type: "json" };
import defaults from "../../Scouter.App/Config/Defaults.json" with { type: "json" };

const kPort = 9530;
const kBase = "/mcp";

interface IRawResponse
{
	Status: number;
	Session: string;
	Events: unknown[];
}

//////////////////////////////////////////////////////////////////////////////////////
// JSON-RPC 1건을 POST한다. node:http라 happy-dom과 무관.
function Post(_body: unknown, _token: string, _session?: string): Promise<IRawResponse>
{
	return new Promise((_resolve, _reject) =>
	{
		const text = JSON.stringify(_body);
		const headers: Record<string, string> = {};
		headers["content-type"] = "application/json";
		headers["accept"] = "application/json, text/event-stream";
		headers["content-length"] = String(Buffer.byteLength(text));
		headers["authorization"] = `Bearer ${_token}`;
		if (_session !== undefined)
			headers["mcp-session-id"] = _session;
		const req = http.request({ host: "127.0.0.1", port: kPort, path: kBase, method: "POST", headers }, (_res) =>
		{
			const chunks: Buffer[] = [];
			_res.on("data", (_chunk: Buffer) => { chunks.push(_chunk); });
			_res.on("end", () =>
			{
				const events: unknown[] = [];
				for (const block of Buffer.concat(chunks).toString("utf-8").split("\n\n"))
				{
					for (const line of block.split("\n"))
					{
						if (line.startsWith("data: "))
						{
							try
							{
								events.push(JSON.parse(line.slice("data: ".length)) as unknown);
							}
							catch
							{
								continue;
							}
						}
					}
				}
				const session = _res.headers["mcp-session-id"];
				_resolve({
					Status: _res.statusCode ?? 0,
					Session: typeof session === "string" ? session : "",
					Events: events,
				});
			});
		});
		req.on("error", _reject);
		req.setTimeout(10000, () => { req.destroy(new Error("timeout")); });
		req.end(text);
	});
}

//////////////////////////////////////////////////////////////////////////////////////
// GET/DELETE 1건을 보낸다.
function Send(_method: string, _path: string, _token: string, _session?: string): Promise<number>
{
	return new Promise((_resolve, _reject) =>
	{
		const headers: Record<string, string> = { authorization: `Bearer ${_token}` };
		if (_session !== undefined)
			headers["mcp-session-id"] = _session;
		const req = http.request({ host: "127.0.0.1", port: kPort, path: _path, method: _method, headers }, (_res) =>
		{
			_res.resume();
			_res.on("end", () => { _resolve(_res.statusCode ?? 0); });
		});
		req.on("error", _reject);
		req.setTimeout(10000, () => { req.destroy(new Error("timeout")); });
		req.end();
	});
}

void describe("McpIntegration", () =>
{
	before(async () =>
	{
		await Settings.Load(path.join(os.tmpdir(), `scouter-mcp-${process.pid}.json`), schema, defaults);
		ApprovalManager.SetTestPolicy("allow");
		ToolRegistry.Register("Test", {
			Name: "Echo",
			Description: "echo",
			InputSchema: { type: "object", properties: { Text: { type: "string" } } },
			Run: (_args) => Promise.resolve({ Echo: _args["Text"] ?? "" }),
		});
		await McpHttpServer.StartAsync(kPort);
		await McpHttpServer.AttachMcpAsync(path.join(os.tmpdir(), `scouter-mcp-home-${process.pid}`), []);
	});

	after(async () =>
	{
		ToolRegistry.RemoveAll("Test");
		await McpHttpServer.StopForTestAsync();
	});

	void it("401 without token", async () =>
	{
		const status = await Send("POST", kBase, "");
		assert.equal(status, 401);
	});

	void it("initialize→list→call→delete", async () =>
	{
		const token = McpHttpServer.Auth?.Token ?? "";
		assert.ok(token.length > 0);
		const init = await Post({
			jsonrpc: "2.0", id: 1, method: "initialize",
			params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0.0.1" } },
		}, token);
		assert.equal(init.Status, 200);
		assert.ok(init.Session.length > 0);
		const first = init.Events[0] as { result?: { serverInfo?: { name?: string } }; id?: number } | undefined;
		assert.ok(first !== undefined);
		assert.equal(first.id, 1);
		assert.equal(first.result?.serverInfo?.name, "scouter");
		const notified = await Post({ jsonrpc: "2.0", method: "notifications/initialized" }, token, init.Session);
		assert.equal(notified.Status, 202);
		const listed = await Post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, token, init.Session);
		const tools = (listed.Events[0] as { result?: { tools?: Array<{ name?: string }> } } | undefined)?.result?.tools ?? [];
		assert.ok(tools.some((_t) => _t.name === "Test__Echo"));
		const called = await Post({
			jsonrpc: "2.0", id: 3, method: "tools/call",
			params: { name: "Test__Echo", arguments: { Text: "hi" } },
		}, token, init.Session);
		const content = (called.Events[0] as { result?: { content?: Array<{ text?: string }> } } | undefined)?.result?.content ?? [];
		assert.match(content[0]?.text ?? "", /hi/);
		const deleted = await Send("DELETE", kBase, token, init.Session);
		assert.ok(deleted === 200 || deleted === 202 || deleted === 405);
	});

	void it("health는 인증 불필요", async () =>
	{
		const status = await Send("GET", "/health", "");
		assert.equal(status, 200);
	});

	void it("sdk Client 상호 운용", () =>
	{
		const child = spawnSync(process.execPath, ["--import", "tsx", "Source/Scouter.Tests/Integration/McpSdkCheck.ts"], { timeout: 90000 });
		assert.equal(child.status, 0);
	});
});
