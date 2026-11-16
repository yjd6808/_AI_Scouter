/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: Stop Tool. 실행 중인 스크립트를 프로세스 트리째 중지한다. Id 1개 또는 All=true로 전부.
	      예약은 건드리지 않는다 — 예약을 끄려면 Update에 Schedule="None"을 준다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { RunnerEngine } from "../RunnerEngine";
import { ScriptFormat } from "../ScriptFormat";

export class StopTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Stop";
	public readonly Description = "실행 중인 스크립트를 중지한다(자식 프로세스까지). Id 하나 또는 All=true로 전부. 예약은 그대로 남는다(예약 해제는 Update Schedule=\"None\").";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Id: { type: "string", description: "중지할 항목 Id" },
			All: { type: "boolean", description: "true면 실행 중인 항목을 전부 중지한다" },
		},
	};
	// 사용자 결정(2026-11-12): MCP 쓰기 Tool은 전부 auto. 중지는 실행을 끝내는 방향이라 위험이 낮다.
	public readonly DefaultApproval = "auto" as const;
	private readonly engine_: RunnerEngine;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진을 주입받는다.
	// @param _engine: 실행 엔진
	public constructor(_engine: RunnerEngine)
	{
		this.engine_ = _engine;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 1개 또는 전부를 중지하고 마지막 실행 기록을 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		if (_args["All"] === true)
		{
			const count = await this.engine_.StopAllAsync();
			return { Ok: true, Stopped: count };
		}
		const id = typeof _args["Id"] === "string" ? _args["Id"].trim() : "";
		if (id.length === 0)
			throw new Error("Id 또는 All=true가 필요합니다.");
		const entry = this.engine_.Store.Find(id);
		if (entry === null)
			throw new Error(`없는 스크립트 Id입니다: ${id}`);
		const stopped = await this.engine_.StopAsync(id);
		return {
			Ok: true,
			Id: id,
			Stopped: stopped ? 1 : 0,
			Message: stopped ? "중지했습니다." : "실행 중이 아니었습니다.",
			LastRun: ScriptFormat.RunSummary(entry.LastRun),
		};
	}
}
