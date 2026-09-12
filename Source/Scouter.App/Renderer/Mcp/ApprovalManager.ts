/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ApprovalManager. auto/ask/deny 5단계 + 직렬 다이얼로그.
*/

import { UIManager } from "@scouter/gui";
import { Settings } from "../Services/Settings";
import { Log } from "../Services/Log";
import type { IRegisteredTool } from "../Plugin/ToolRegistry";
import type { ISession } from "./SessionManager";

export type ApprovalKind = "auto" | "ask" | "deny";
export type ApprovalDecision = "Allow" | "AllowAlways" | "Deny";

export class ApprovalManager
{
	// ==================== 정적 ====================
	private static s_queue_: Promise<void> = Promise.resolve();
	private static s_policy_: "allow" | "deny" | "manual" = "manual";

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 테스트용 자동 응답을 둔다. Test API가 사용.
	// @param _policy: 정책
	public static SetTestPolicy(_policy: "allow" | "deny" | "manual"): void
	{
		ApprovalManager.s_policy_ = _policy;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 여부를 정한다. ask면 다이얼로그(직렬).
	// @param _tool: 등록 Tool
	// @param _session: 세션
	// @param _args: 인자 요약용
	public static async DecideAsync(_tool: IRegisteredTool, _session: ISession, _args: Record<string, unknown>): Promise<{ Decision: ApprovalDecision; Remember: boolean }>
	{
		const policy = ApprovalManager.Policy(_tool, _session);
		if (policy === "auto")
			return { Decision: "Allow", Remember: false };
		if (policy === "deny")
			return { Decision: "Deny", Remember: false };
		if (ApprovalManager.s_policy_ === "allow")
			return { Decision: "Allow", Remember: false };
		if (ApprovalManager.s_policy_ === "deny")
			return { Decision: "Deny", Remember: false };
		const previous = ApprovalManager.s_queue_;
		let release: () => void = () => undefined;
		ApprovalManager.s_queue_ = previous.then(() => new Promise<void>((_resolve) => { release = _resolve; }));
		await previous;
		try
		{
			const keys = Object.keys(_args);
			Log.Info("Mcp", `승인 요청: ${_tool.FullName} (${keys.length} args)`);
			const result = await UIManager.ShowDialogAsync<{ Kind: ApprovalDecision; Remember: boolean }>("ApprovalDialog", {
				toolName: _tool.FullName,
				clientName: `${_session.Client} (${_session.Id.slice(0, 8)})`,
				argsJson: JSON.stringify(_args, null, 2).slice(0, 4000),
			}, 30000);
			if (result.Remember && result.Kind === "AllowAlways")
				_session.AlwaysAllow.add(_tool.FullName);
			return { Decision: result.Kind, Remember: result.Remember };
		}
		catch
		{
			return { Decision: "Deny", Remember: false };
		}
		finally
		{
			release();
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 5단계 우선순위. 설정 → 세션 → 기본값 → 어노테이션 → 전역.
	// @param _tool: 등록 Tool
	// @param _session: 세션
	private static Policy(_tool: IRegisteredTool, _session: ISession): ApprovalKind
	{
		try
		{
			const override = Settings.Get<string>(`Mcp.Tools.${_tool.FullName}.Approval`, "");
			if (override === "auto" || override === "ask" || override === "deny")
				return override;
		}
		catch
		{
			// 미설정. 다음 단계.
		}
		if (_session.AlwaysAllow.has(_tool.FullName))
			return "auto";
		if (_tool.Tool.DefaultApproval === "auto" || _tool.Tool.DefaultApproval === "ask" || _tool.Tool.DefaultApproval === "deny")
			return _tool.Tool.DefaultApproval;
		if (_tool.Tool.Annotations?.ReadOnly === true)
			return "auto";
		if (_tool.Tool.Annotations?.Destructive === true)
			return "ask";
		return Settings.Get<ApprovalKind>("Mcp.DefaultApproval", "ask");
	}
}
