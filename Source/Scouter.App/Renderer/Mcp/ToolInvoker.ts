/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ToolInvoker. 검증→승인→실행→자르기→감사 한 줄기.
*/

import Ajv from "ajv";
import type { ValidateFunction } from "ajv";
import { EventBus } from "../Services/EventBus";
import { Log } from "../Services/Log";
import { ToolRegistry } from "../Plugin/ToolRegistry";
import { ApprovalManager } from "./ApprovalManager";
import { AuditLog } from "./AuditLog";
import { ResultTruncator } from "./ResultTruncator";
import type { ISession } from "./SessionManager";

export interface ICallResult
{
	Content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
	IsError?: boolean;
}

export class ToolInvoker
{
	// ==================== 정적 ====================
	private static readonly s_validators_ = new Map<string, ValidateFunction>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool 1건을 실행한다.
	// @param _fullName: {PluginId}__{Tool}
	// @param _args: 인자
	// @param _session: 세션
	// @param _progress: 진행 알림
	// @param _signal: 중단 신호
	public static async InvokeAsync(
		_fullName: string,
		_args: Record<string, unknown>,
		_session: ISession,
		_progress: (_n: number, _msg: string) => void,
		_signal: AbortSignal,
	): Promise<ICallResult>
	{
		const started = Date.now();
		const found = ToolRegistry.Find(_fullName);
		if (found === null)
			return ToolInvoker.Fail(`unknown tool: ${_fullName}`, _session, _fullName, _args, started, "missing");
		const invalid = ToolInvoker.Validate(found.Tool.InputSchema, _args);
		if (invalid !== null)
			return ToolInvoker.Fail(`invalid arguments: ${invalid}`, _session, _fullName, _args, started, "validation");
		const approval = await ApprovalManager.DecideAsync(found, _session, _args);
		if (approval.Decision === "Deny")
			return ToolInvoker.Fail("denied by policy", _session, _fullName, _args, started, "deny");
		_session.CallCount++;
		try
		{
			const raw = await found.Tool.Run(_args, {
				SessionId: _session.Id,
				Progress: _progress,
				Signal: _signal,
				Log: (_msg) =>
				{
					Log.Info(_fullName, _msg);
				},
			});
			const truncated = ResultTruncator.Apply(raw);
			const content = truncated.Content.map((_block) =>
			{
				if (_block.Type === "image")
					return { type: "image", data: _block.Base64 ?? "", mimeType: _block.MimeType ?? "image/png" };
				return { type: "text", text: _block.Text ?? "" };
			});
			AuditLog.Append({
				At: new Date().toISOString(), Session: _session.Id, Client: _session.Client, Tool: _fullName,
				ArgsSummary: ResultTruncator.Summarize(_args), Decision: approval.Decision, DurationMs: Date.now() - started, Ok: true,
			});
			EventBus.Publish("Scouter.ToolCalled", { Tool: _fullName, Session: _session.Id, Decision: approval.Decision, Ok: true });
			return { Content: content };
		}
		catch (_e)
		{
			return ToolInvoker.Fail(String(_e), _session, _fullName, _args, started, approval.Decision);
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// InputSchema 검증. 통과면 null.
	// @param _schema: 스키마
	// @param _args: 인자
	private static Validate(_schema: Record<string, unknown>, _args: Record<string, unknown>): string | null
	{
		try
		{
			let validate = ToolInvoker.s_validators_.get(JSON.stringify(_schema));
			if (validate === undefined)
			{
				const ajv = new Ajv({ allErrors: true });
				validate = ajv.compile(_schema);
				ToolInvoker.s_validators_.set(JSON.stringify(_schema), validate);
			}
			if (validate(_args))
				return null;
			const first = validate.errors?.[0];
			return `${first?.instancePath ?? ""} ${first?.message ?? ""}`.trim();
		}
		catch
		{
			return null;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에러 결과 + 감사 + 이벤트.
	// @param _msg: 메시지
	// @param _session: 세션
	// @param _tool: Tool 이름
	// @param _args: 인자
	// @param _started: 시작 시각
	// @param _decision: 결정
	private static Fail(_msg: string, _session: ISession, _tool: string, _args: Record<string, unknown>, _started: number, _decision: string): ICallResult
	{
		AuditLog.Append({
			At: new Date().toISOString(), Session: _session.Id, Client: _session.Client, Tool: _tool,
			ArgsSummary: ResultTruncator.Summarize(_args), Decision: _decision, DurationMs: Date.now() - _started, Ok: false,
		});
		EventBus.Publish("Scouter.ToolCalled", { Tool: _tool, Session: _session.Id, Decision: _decision, Ok: false });
		return { Content: [{ type: "text", text: _msg }], IsError: true };
	}
}
