/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: ArmGroup Tool. 저장된 그룹(템플릿)을 통째로 예약한다. 기준 시각 하나로 전부 계산된다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { AlarmEngine } from "../AlarmEngine";
import { AlarmFormat } from "../AlarmFormat";

export class ArmGroupTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ArmGroup";
	public readonly Description = "이름으로 그룹을 찾아 그 안의 알람을 한 번에 예약한다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			GroupName: { type: "string", description: "저장된 그룹 이름" },
		},
		required: ["GroupName"],
	};
	// 자기 저장소에만 쓰고 Cancel로 되돌릴 수 있어 승인 없이 둔다.
	public readonly DefaultApproval = "auto" as const;
	private readonly engine_: AlarmEngine;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진을 주입받는다.
	// @param _engine: 알람 엔진
	public constructor(_engine: AlarmEngine)
	{
		this.engine_ = _engine;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹을 예약한다. 하나도 못 걸었으면 사유를 모아 실패로 던진다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const name = _args["GroupName"];
		if (typeof name !== "string" || name.trim().length === 0)
			return Promise.reject(new Error("GroupName required"));
		const group = this.engine_.Store.FindGroupByName(name.trim());
		if (group === null)
			return Promise.reject(new Error(`그룹 없음: ${name.trim()}`));
		const report = this.engine_.ArmGroup(group);
		if (report.Armed.length === 0)
			return Promise.reject(new Error(report.Errors.length > 0 ? report.Errors.join(" / ") : "예약된 알람이 없다"));
		const now = Date.now();
		return Promise.resolve({
			Ok: true,
			GroupName: report.GroupName,
			Armed: report.Armed.map((_a) => AlarmFormat.Summary(_a, now)),
			Errors: report.Errors,
		});
	}
}
