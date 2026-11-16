/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: Remove Tool. 등록된 스크립트를 목록에서 지운다. 실행 중이면 먼저 중지한다. 스크립트 파일은 건드리지 않는다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { RunnerEngine } from "../RunnerEngine";

export class RemoveTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Remove";
	public readonly Description = "등록된 스크립트를 ScriptRunner 목록에서 지운다(Id 필수). 실행 중이면 먼저 중지한다. 스크립트 파일 자체는 지우지 않는다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Id: { type: "string", description: "지울 항목 Id" },
		},
		required: ["Id"],
	};
	// 사용자 결정(2026-11-12): MCP 쓰기 Tool은 전부 auto. 지우는 것은 Plugin 자기 목록뿐이다.
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
	// 항목을 지운다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const id = typeof _args["Id"] === "string" ? _args["Id"].trim() : "";
		const entry = this.engine_.Store.Find(id);
		if (entry === null)
			throw new Error(`없는 스크립트 Id입니다: ${id}`);
		const wasRunning = this.engine_.IsRunning(id);
		await this.engine_.RemoveAsync(id);
		return { Ok: true, Id: id, Title: entry.Title, StoppedFirst: wasRunning };
	}
}
