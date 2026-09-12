/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SDK 상호 운용 자식 프로세스. happy-dom 없이 실제 sdk Client로 접속.
*/

import * as os from "node:os";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpHttpServer } from "../../Scouter.App/Renderer/Mcp/McpHttpServer";
import { ToolRegistry } from "../../Scouter.App/Renderer/Plugin/ToolRegistry";
import { ApprovalManager } from "../../Scouter.App/Renderer/Mcp/ApprovalManager";
import { Settings } from "../../Scouter.App/Renderer/Services/Settings";
import schema from "../../Scouter.App/Config/Settings.schema.json" with { type: "json" };
import defaults from "../../Scouter.App/Config/Defaults.json" with { type: "json" };

async function Main(): Promise<void>
{
	const tag = `sdkcheck-${process.pid}`;
	await Settings.Load(path.join(os.tmpdir(), `${tag}.json`), schema, defaults);
	ApprovalManager.SetTestPolicy("allow");
	ToolRegistry.Register("Test", {
		Name: "Echo",
		Description: "echo",
		InputSchema: { type: "object", properties: { Text: { type: "string" } } },
		Run: (_args) => Promise.resolve({ Echo: _args["Text"] ?? "" }),
	});
	const port = 9531;
	await McpHttpServer.StartAsync(port);
	await McpHttpServer.AttachMcpAsync(path.join(os.tmpdir(), `${tag}-home`), []);
	const token = McpHttpServer.Auth?.Token ?? "";
	if (token.length === 0)
		throw new Error("토큰 없음");
	const client = new Client({ name: "sdkcheck", version: "0.0.1" }, { capabilities: {} });
	const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
		requestInit: { headers: { Authorization: `Bearer ${token}` } },
	});
	await client.connect(transport);
	const listed = await client.listTools();
	if (!listed.tools.some((_t) => _t.name === "Test__Echo"))
		throw new Error("Echo 없음");
	const called = await client.callTool({ name: "Test__Echo", arguments: { Text: "hi" } });
	const first = (called.content as Array<{ type: string; text?: string }>)[0];
	if (!/hi/.test(first?.text ?? ""))
		throw new Error("echo 불일치");
	await transport.terminateSession();
	await client.close();
	ToolRegistry.RemoveAll("Test");
	await McpHttpServer.StopForTestAsync();
}

Main().then(
	() => { process.exit(0); },
	(_e: unknown) => { console.error(String(_e)); process.exit(1); },
);
