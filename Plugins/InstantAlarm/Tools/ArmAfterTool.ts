/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: ArmAfter Tool. 지금부터 N초 뒤 알람 1건을 예약한다. 엔진 인스턴스는 Index에서 주입받는다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { AlarmEngine } from "../AlarmEngine";
import { AlarmFormat } from "../AlarmFormat";
import { SpecFactory } from "../SpecFactory";
import type { IAlarmOptions } from "../Types";

export class ArmAfterTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ArmAfter";
	public readonly Description = "지금부터 Seconds초 뒤에 울릴 알람을 예약한다. 1초 미만은 거부된다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Seconds: { type: "number", description: "지금부터 몇 초 뒤에 울릴지" },
			Title: { type: "string", description: "알람 제목" },
			Message: { type: "string", description: "알람 내용(선택)" },
		},
		required: ["Seconds", "Title"],
	};
	// 자기 저장소에만 쓰고 Cancel로 되돌릴 수 있어 승인 없이 둔다.
	public readonly DefaultApproval = "auto" as const;
	private readonly engine_: AlarmEngine;
	private readonly options_: IAlarmOptions;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진과 설정 getter를 주입받는다. 엔진은 Index가 만든 그 인스턴스여야 한다.
	// @param _engine: 알람 엔진
	// @param _options: 설정 getter 묶음
	public constructor(_engine: AlarmEngine, _options: IAlarmOptions)
	{
		this.engine_ = _engine;
		this.options_ = _options;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상대 알람을 예약한다. 엔진이 거부하면 사유를 그대로 실패로 바꿔 던진다.
	// Run 안에서 동기 throw는 금지라 전부 Promise.reject로 감싼다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const seconds = _args["Seconds"];
		if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 1)
			return Promise.reject(new Error("Seconds는 1 이상의 숫자여야 한다"));
		const title = _args["Title"];
		if (typeof title !== "string" || title.trim().length === 0)
			return Promise.reject(new Error("Title required"));
		const rawMessage = _args["Message"];
		const message = typeof rawMessage === "string" ? rawMessage : "";
		const spec = SpecFactory.After(this.engine_.Store.NewId("spec"), seconds, title.trim(), message, this.options_);
		const outcome = this.engine_.ArmSpec(spec, "");
		if (!outcome.Ok)
			return Promise.reject(new Error(outcome.Error));
		return Promise.resolve({ Ok: true, Alarm: AlarmFormat.Summary(outcome.Alarm, Date.now()) });
	}
}
