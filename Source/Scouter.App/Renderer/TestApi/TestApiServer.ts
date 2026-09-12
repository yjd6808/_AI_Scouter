/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Test API. tree/find/click/settings/logs/eval + approval/permission. type/key는 P4.
*/

import type { IncomingMessage, ServerResponse } from "node:http";
import { UIManager, UIElement } from "@scouter/gui";
import type { McpHttpServer } from "../Mcp/McpHttpServer";
import { Settings } from "../Services/Settings";
import { Log } from "../Services/Log";
import { Ipc } from "../Services/Ipc";
import { ApprovalManager } from "../Mcp/ApprovalManager";

interface ITreeNode
{
	TypeName: string;
	Name: string;
	Visible: boolean;
	Enabled: boolean;
	Children: ITreeNode[];
}

function Json(_res: ServerResponse, _code: number, _body: unknown): void
{
	_res.statusCode = _code;
	_res.setHeader("content-type", "application/json");
	_res.end(JSON.stringify(_body));
}

function ReadBody(_req: IncomingMessage): Promise<Record<string, unknown>>
{
	return new Promise((_resolve) =>
	{
		let text = "";
		_req.on("data", (_chunk: Buffer) => { text += _chunk.toString("utf-8"); });
		_req.on("end", () =>
		{
			try
			{
				_resolve(JSON.parse(text) as Record<string, unknown>);
			}
			catch
			{
				_resolve({});
			}
		});
	});
}

function PhaseOf(): string
{
	const root = document.getElementById("root");
	if (root === null)
		return "boot";
	return UIManager.Find("Shell") !== null ? "shell" : "ready";
}

function ToTree(_el: UIElement, _depth: number): ITreeNode
{
	const kids: ITreeNode[] = [];
	if (_depth !== 0)
	{
		for (const child of _el.Children)
			kids.push(ToTree(child, _depth > 0 ? _depth - 1 : _depth));
	}
	return { TypeName: _el.constructor.name, Name: _el.Name, Visible: _el.IsVisible, Enabled: _el.IsEnabled, Children: kids };
}

function FindByName(_name: string): UIElement | null
{
	const shell = UIManager.Find("Shell");
	if (shell !== null)
	{
		if (shell.Name === _name)
			return shell;
		const inShell = FindInTree(shell, _name);
		if (inShell !== null)
			return inShell;
	}
	return FindInDialogs(_name);
}

function FindInTree(_root: UIElement, _name: string): UIElement | null
{
	const stack: UIElement[] = [..._root.Children];
	while (stack.length > 0)
	{
		const current = stack.pop() as UIElement;
		if (current.Name === _name)
			return current;
		for (const child of current.Children)
			stack.push(child);
	}
	return null;
}

function FindInDialogs(_name: string): UIElement | null
{
	const active = UIManager.Active;
	if (active === null)
		return null;
	if (active.Name === _name)
		return active;
	return FindInTree(active, _name);
}

function OnPing(_res: ServerResponse): Promise<void>
{
	Json(_res, 200, { Ready: true, Phase: PhaseOf(), Version: "0.4.0" });
	return Promise.resolve();
}

function OnTree(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const url = new URL(_req.url ?? "/", "http://127.0.0.1");
	const depth = Number(url.searchParams.get("depth") ?? "3");
	const shell = UIManager.Find("Shell");
	if (shell === null)
	{
		Json(_res, 404, { Ok: false });
		return Promise.resolve();
	}
	Json(_res, 200, ToTree(shell, Number.isNaN(depth) ? 3 : depth));
	return Promise.resolve();
}

function OnFind(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const url = new URL(_req.url ?? "/", "http://127.0.0.1");
	const name = url.searchParams.get("name") ?? "";
	const found = FindByName(name);
	if (found === null)
	{
		Json(_res, 404, { Ok: false });
		return Promise.resolve();
	}
	const rect = found.Element.getBoundingClientRect();
	Json(_res, 200, { TypeName: found.constructor.name, Name: found.Name, Visible: found.IsVisible, Enabled: found.IsEnabled, Rect: { Width: rect.width, Height: rect.height } });
	return Promise.resolve();
}

async function OnClick(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const body = await ReadBody(_req);
	const rawName = body["Name"];
	const name = typeof rawName === "string" ? rawName : "";
	const found = FindByName(name);
	if (found === null)
	{
		Json(_res, 404, { Ok: false });
		return;
	}
	if (!found.IsVisible || !found.IsEnabled)
	{
		Json(_res, 409, { Ok: false });
		return;
	}
	const rect = found.Element.getBoundingClientRect();
	const cx = rect.left + rect.width / 2;
	const cy = rect.top + rect.height / 2;
	found.Element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
	found.Element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
	Json(_res, 200, { Ok: true });
}

function OnSettingsGet(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const url = new URL(_req.url ?? "/", "http://127.0.0.1");
	const path = url.searchParams.get("path") ?? "";
	try
	{
		Json(_res, 200, { Ok: true, Value: Settings.Get<unknown>(path) });
	}
	catch
	{
		Json(_res, 404, { Ok: false });
	}
	return Promise.resolve();
}

async function OnSettingsSet(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const body = await ReadBody(_req);
	const rawPath = body["Path"];
	const rawValue = body["Value"];
	try
	{
		if (typeof rawPath !== "string")
			throw new Error("path");
		Settings.Set(rawPath, rawValue);
		Json(_res, 200, { Ok: true });
	}
	catch
	{
		Json(_res, 400, { Ok: false });
	}
}

function OnLogs(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const url = new URL(_req.url ?? "/", "http://127.0.0.1");
	const levelText = url.searchParams.get("level");
	if (levelText === null)
	{
		Json(_res, 200, Log.Buffer.Query({ Limit: 200 }));
	}
	else
	{
		Json(_res, 200, Log.Buffer.Query({ Level: levelText as "debug" | "info" | "warn" | "error", Limit: 200 }));
	}
	return Promise.resolve();
}

async function OnScreenshot(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const shot = await Ipc.Invoke<{ Png?: string }>("app:capture-page");
	if (shot?.Png === undefined)
	{
		Json(_res, 501, { Ok: false });
		return;
	}
	Json(_res, 200, { Ok: true, Bytes: shot.Png.length });
}

async function OnApproval(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const body = await ReadBody(_req);
	const policy = body["Policy"];
	if (policy !== "allow" && policy !== "deny" && policy !== "manual")
	{
		Json(_res, 400, { Ok: false });
		return;
	}
	ApprovalManager.SetTestPolicy(policy);
	Json(_res, 200, { Ok: true });
}

async function OnPermission(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const body = await ReadBody(_req);
	const id = body["PluginId"];
	const grant = body["Grant"];
	if (typeof id !== "string" || typeof grant !== "boolean")
	{
		Json(_res, 400, { Ok: false });
		return;
	}
	TestApiServer.DecidePermission(id, grant);
	Json(_res, 200, { Ok: true });
}

async function OnEval(_req: IncomingMessage, _res: ServerResponse): Promise<void>
{
	const body = await ReadBody(_req);
	const script = body["Script"];
	if (typeof script !== "string")
	{
		Json(_res, 400, { Ok: false });
		return;
	}
	try
	{
		// eslint-disable-next-line @typescript-eslint/no-implied-eval -- --test 전용 Eval 라우트 자체가 eval이다
		const fn = new Function(`return (${script});`) as () => unknown;
		const value = await fn();
		let text = "\"<unserializable>\"";
		try
		{
			text = JSON.stringify(value);
		}
		catch
		{
			// 직렬화 불가면 플레이스홀더.
		}
		Json(_res, 200, { Ok: true, Value: JSON.parse(text) as unknown });
	}
	catch (_e)
	{
		Json(_res, 200, { Ok: false, Error: String(_e) });
	}
}

export class TestApiServer
{
	// ==================== 정적 ====================
	private static readonly s_permDecisions_ = new Map<string, boolean>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 승인 결정을 기록한다. PermissionDialog 대신. 매니저가 조회.
	// @param _id: Plugin Id
	// @param _grant: 승인 여부
	public static DecidePermission(_id: string, _grant: boolean): void
	{
		TestApiServer.s_permDecisions_.set(_id, _grant);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기록된 결정을 읽는다. 없으면 null.
	// @param _id: Plugin Id
	public static PermissionDecision(_id: string): boolean | null
	{
		return TestApiServer.s_permDecisions_.get(_id) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// /test/* 라우트를 부착한다.
	// @param _server: McpHttpServer 클래스 (Router 공유)
	public static Attach(_server: typeof McpHttpServer): void
	{
		_server.Router.Add("GET", "/test/ping", (_req, _res) => void OnPing(_res));
		_server.Router.Add("GET", "/test/tree", (_req, _res) => void OnTree(_req, _res));
		_server.Router.Add("GET", "/test/find", (_req, _res) => void OnFind(_req, _res));
		_server.Router.Add("POST", "/test/click", (_req, _res) => void OnClick(_req, _res));
		_server.Router.Add("GET", "/test/settings", (_req, _res) => void OnSettingsGet(_req, _res));
		_server.Router.Add("POST", "/test/settings", (_req, _res) => void OnSettingsSet(_req, _res));
		_server.Router.Add("GET", "/test/logs", (_req, _res) => void OnLogs(_req, _res));
		_server.Router.Add("POST", "/test/screenshot", (_req, _res) => void OnScreenshot(_req, _res));
		_server.Router.Add("POST", "/test/approval", (_req, _res) => void OnApproval(_req, _res));
		_server.Router.Add("POST", "/test/permission", (_req, _res) => void OnPermission(_req, _res));
		_server.Router.Add("POST", "/test/eval", (_req, _res) => void OnEval(_req, _res));
	}
}

export type { ITreeNode };
