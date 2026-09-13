/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: State Tool. 쌓인 이벤트 상태를 읽는다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { ControlStore } from "../ControlStore";

export class StateTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "State";
	public readonly Description = "기록된 컨트롤 이벤트 상태를 읽는다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Limit: { type: "number" },
		},
	};
	public readonly Annotations = { ReadOnly: true };
	private readonly store_: ControlStore;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소로 만든다. Index OnActivate에서 주입.
	// @param _store: 이벤트 저장소
	public constructor(_store: ControlStore)
	{
		this.store_ = _store;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 개수와 최근 이벤트를 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const rawLimit = _args["Limit"];
		const limit = typeof rawLimit === "number" && Number.isFinite(rawLimit) && rawLimit > 0
			? Math.min(Math.floor(rawLimit), 50)
			: 20;
		return Promise.resolve({ Ok: true, Count: this.store_.Count(), Events: this.store_.Recent(limit) });
	}
}
