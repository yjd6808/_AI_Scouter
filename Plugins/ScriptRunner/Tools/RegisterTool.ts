/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: Register Tool. 스크립트를 등록한다. 예약(시간 뒤 / 특정 시각, 반복)과 인자 정의를 함께 받고,
	      RunNow=true면 등록 직후 바로 실행한다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { RunnerEngine } from "../RunnerEngine";
import { ScriptFormat } from "../ScriptFormat";
import { SpecReader } from "../SpecReader";
import { ScheduleProps } from "./ScheduleProps";

export class RegisterTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Register";
	public readonly Description = "실행할 스크립트(.ps1 .bat .cmd .exe .py .js)를 ScriptRunner에 등록한다. 인자 정의(Args)와 예약(Schedule: None|After|At, Repeat)을 함께 줄 수 있다. 인자는 정의 순서대로 위치 인자로 넘어간다. 가운데 빈 값은 빈 문자열로 자리를 지키고, 끝쪽의 빈 값만 빠진다. 반복 규칙: After는 같은 간격마다, At은 매일 같은 시각. KeepAfterBoot(부팅 후에도 스케줄 적용, 기본 false)가 false면 PC를 다시 켠 뒤 예약이 풀린다. 결과의 Item.Id로 Run·Stop·Update·Remove·GetOutput을 부른다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Title: { type: "string", description: "목록에 보일 제목. 생략하면 \"스크립트-N\"" },
			Path: { type: "string", description: "스크립트 파일 절대 경로. 작업 폴더는 이 파일이 있는 폴더가 된다" },
			Args: {
				type: "array",
				description: "인자 정의(순서 = 전달 순서). 항목은 {Name, Required(기본 true), Value(초기 값)} 또는 이름 문자열",
				items: {
					oneOf: [
						{ type: "string" },
						{
							type: "object",
							properties: {
								Name: { type: "string" },
								Required: { type: "boolean" },
								Value: { type: "string" },
							},
							required: ["Name"],
						},
					],
				},
			},
			...ScheduleProps.Properties(),
			RunNow: { type: "boolean", description: "true면 등록 직후 한 번 바로 실행한다" },
		},
		required: ["Path"],
	};
	// 사용자 결정(2026-11-12): AI가 승인 없이 스크립트를 등록·실행할 수 있게 쓰기 Tool을 전부 auto로 둔다.
	// Process 권한 Tool이라 Scouter 설정 화면에 auto 경고 배지가 뜬다. 막으려면 Mcp.Tools 설정에서 ask로 바꾼다.
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
	// 입력을 굳혀 등록하고, 원하면 바로 실행한다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const spec = SpecReader.ReadSpec(_args);
		if (!spec.Ok)
			return Promise.reject(new Error(spec.Error));
		const outcome = this.engine_.Register(spec.Spec);
		if (!outcome.Ok)
			return Promise.reject(new Error(outcome.Error));
		let runId = "";
		let runError = "";
		if (_args["RunNow"] === true)
		{
			const run = this.engine_.Run(outcome.Entry.Id, "Mcp");
			if (run.Ok)
				runId = run.RunId;
			else
				runError = run.Error;
		}
		const now = Date.now();
		return Promise.resolve({
			Ok: true,
			Item: ScriptFormat.Summary(outcome.Entry, this.engine_.StateOf(outcome.Entry), now),
			RunId: runId,
			RunError: runError,
		});
	}
}
