/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: Cancel Tool. 예약 1건(Id) 또는 전체(All)를 취소한다. 이미 울린 건은 취소 대상이 아니다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { AlarmEngine } from "../AlarmEngine";

export class CancelTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Cancel";
	public readonly Description = "예약을 취소한다. Id로 1건, All=true로 예약 전체를 취소한다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Id: { type: "string", description: "예약 인스턴스 Id" },
			All: { type: "boolean", description: "예약 전체 취소" },
		},
	};
	// 사용자의 예약을 없애므로 기본 승인(ask)을 받는다.
	public readonly Annotations = { Destructive: true };
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
	// Id 또는 All로 취소한다. 둘 다 없으면 실패.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		if (_args["All"] === true)
		{
			const ids = this.engine_.PendingList().map((_a) => _a.Id);
			let count = 0;
			for (const id of ids)
			{
				if (this.engine_.Cancel(id))
					count += 1;
			}
			return Promise.resolve({ Ok: true, Canceled: count, Ids: ids });
		}
		const id = _args["Id"];
		if (typeof id !== "string" || id.trim().length === 0)
			return Promise.reject(new Error("Id 또는 All 중 하나가 필요하다"));
		if (!this.engine_.Cancel(id.trim()))
			return Promise.reject(new Error(`취소할 예약이 없다: ${id.trim()}`));
		return Promise.resolve({ Ok: true, Canceled: 1, Ids: [id.trim()] });
	}
}
