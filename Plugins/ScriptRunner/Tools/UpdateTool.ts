/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: Update Tool. 등록된 스크립트의 제목·경로·인자 정의·인자 값·예약을 고친다. 준 필드만 바뀐다.
	      예약 필드를 주면 첫 실행 시각을 지금 기준으로 다시 건다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { RunnerEngine } from "../RunnerEngine";
import { ScriptFormat } from "../ScriptFormat";
import { SpecReader } from "../SpecReader";
import { ScheduleProps } from "./ScheduleProps";

export class UpdateTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Update";
	public readonly Description = "등록된 스크립트를 고친다(Id 필수, 준 필드만 바뀜). Title·Path·Args(인자 정의 전체 교체)·ArgValues(값만 변경)·예약 필드(Schedule·AfterSeconds·AtTime·AtDate·Repeat)를 받는다. 예약을 끄려면 Schedule=\"None\". 예약 필드를 주면 지금 기준으로 다시 예약한다. KeepAfterBoot(부팅 후에도 스케줄 적용)만 바꾸면 남은 시간은 그대로다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Id: { type: "string", description: "고칠 항목 Id(List의 Items[].Id)" },
			Title: { type: "string" },
			Path: { type: "string" },
			Args: {
				type: "array",
				description: "인자 정의 전체 교체. 항목은 {Name, Required(기본 true), Value} 또는 이름 문자열",
				items: {
					oneOf: [
						{ type: "string" },
						{ type: "object", properties: { Name: { type: "string" }, Required: { type: "boolean" }, Value: { type: "string" } }, required: ["Name"] },
					],
				},
			},
			ArgValues: ScheduleProps.ArgValues(),
			...ScheduleProps.Properties(),
		},
		required: ["Id"],
	};
	// 사용자 결정(2026-11-12): MCP 쓰기 Tool은 전부 auto. 항목 정의만 바꾸고 실행하지는 않는다.
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
	// 입력을 패치로 굳혀 적용한다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const id = typeof _args["Id"] === "string" ? _args["Id"].trim() : "";
		const entry = this.engine_.Store.Find(id);
		if (entry === null)
			return Promise.reject(new Error(`없는 스크립트 Id입니다: ${id}`));
		const patch = SpecReader.ReadPatch(_args, entry);
		if (!patch.Ok)
			return Promise.reject(new Error(patch.Error));
		const outcome = this.engine_.Update(id, patch.Patch);
		if (!outcome.Ok)
			return Promise.reject(new Error(outcome.Error));
		return Promise.resolve({ Ok: true, Item: ScriptFormat.Summary(outcome.Entry, this.engine_.StateOf(outcome.Entry), Date.now()) });
	}
}
