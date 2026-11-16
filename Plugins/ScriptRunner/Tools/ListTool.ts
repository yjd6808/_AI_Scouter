/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: List Tool. 등록된 스크립트 목록(Id·제목·스크립트 이름·상태·인자·예약·남은 시간·마지막 실행)을 돌려준다.
	      읽기 전용이라 승인 없이 조회된다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { RunnerEngine } from "../RunnerEngine";
import { ScriptFormat } from "../ScriptFormat";

export class ListTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "List";
	public readonly Description = "ScriptRunner에 등록된 스크립트 목록을 돌려준다. 항목마다 Id, Title, ScriptName, Path, State(Idle|Scheduled|Running), Args(이름·필수·현재 값), Schedule, RemainingMs, LastRun(결과·종료 코드)을 싣는다. RunningOnly=true면 실행 중인 것만, Id를 주면 그 항목만 돌려준다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Id: { type: "string", description: "이 Id 항목만 조회한다(예: \"s3\")" },
			RunningOnly: { type: "boolean", description: "true면 지금 실행 중인 항목만 돌려준다" },
		},
	};
	// 상태를 바꾸지 않는 조회 전용. 승인 프롬프트 없이 불려야 쓸모가 있다.
	public readonly Annotations = { ReadOnly: true };
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
	// 항목을 걸러 요약을 돌려준다. 남은 시간은 지금 파생한 값이다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const now = Date.now();
		const id = typeof _args["Id"] === "string" ? _args["Id"].trim() : "";
		const runningOnly = _args["RunningOnly"] === true;
		const all = this.engine_.Store.List();
		if (id.length > 0 && all.every((_e) => _e.Id !== id))
			return Promise.reject(new Error(`없는 스크립트 Id입니다: ${id}`));
		const picked = all.filter((_e) => (id.length === 0 || _e.Id === id) && (!runningOnly || this.engine_.IsRunning(_e.Id)));
		const states = all.map((_e) => this.engine_.StateOf(_e));
		return Promise.resolve({
			Ok: true,
			NowMs: now,
			Counts: {
				Total: all.length,
				Running: states.filter((_s) => _s === "Running").length,
				Scheduled: states.filter((_s) => _s === "Scheduled").length,
				Idle: states.filter((_s) => _s === "Idle").length,
			},
			Items: picked.map((_e) => ScriptFormat.Summary(_e, this.engine_.StateOf(_e), now)),
		});
	}
}
