/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: ArmAt Tool. "HH:mm" 또는 "YYYY-MM-DD HH:mm" 시각에 울릴 알람 1건을 예약한다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { AlarmEngine } from "../AlarmEngine";
import { AlarmFormat } from "../AlarmFormat";
import { SpecFactory } from "../SpecFactory";
import type { IAlarmOptions } from "../Types";

export class ArmAtTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ArmAt";
	public readonly Description = "지정한 시각에 울릴 알람을 예약한다. AtTime은 \"HH:mm\" 또는 \"YYYY-MM-DD HH:mm\". 이미 지난 시각은 RollToNextDay=true일 때만 다음 날로 넘어간다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			AtTime: { type: "string", description: "\"HH:mm\" 또는 \"YYYY-MM-DD HH:mm\"" },
			Title: { type: "string", description: "알람 제목" },
			Message: { type: "string", description: "알람 내용(선택)" },
			RollToNextDay: { type: "boolean", description: "이미 지난 시각이면 다음 날로 넘길지" },
		},
		required: ["AtTime", "Title"],
	};
	// 자기 저장소에만 쓰고 Cancel로 되돌릴 수 있어 승인 없이 둔다.
	public readonly DefaultApproval = "auto" as const;
	private readonly engine_: AlarmEngine;
	private readonly options_: IAlarmOptions;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진과 설정 getter를 주입받는다.
	// @param _engine: 알람 엔진
	// @param _options: 설정 getter 묶음
	public constructor(_engine: AlarmEngine, _options: IAlarmOptions)
	{
		this.engine_ = _engine;
		this.options_ = _options;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 절대 알람을 예약한다. 형식 오류·지난 시각은 엔진 판정을 그대로 실패로 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const atTime = _args["AtTime"];
		if (typeof atTime !== "string" || atTime.trim().length === 0)
			return Promise.reject(new Error("AtTime required"));
		const title = _args["Title"];
		if (typeof title !== "string" || title.trim().length === 0)
			return Promise.reject(new Error("Title required"));
		const rawMessage = _args["Message"];
		const message = typeof rawMessage === "string" ? rawMessage : "";
		const roll = _args["RollToNextDay"] === true;
		const spec = SpecFactory.At(this.engine_.Store.NewId("spec"), atTime, title.trim(), message, roll, this.options_);
		const outcome = this.engine_.ArmSpec(spec, "");
		if (!outcome.Ok)
			return Promise.reject(new Error(outcome.Error));
		return Promise.resolve({ Ok: true, Alarm: AlarmFormat.Summary(outcome.Alarm, Date.now()) });
	}
}
