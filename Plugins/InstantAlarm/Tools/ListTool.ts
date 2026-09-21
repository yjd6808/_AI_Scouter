/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: List Tool. 예약·완료·지나감 목록과 남은 시간을 돌려준다. 읽기 전용이라 승인 없이 조회된다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { AlarmEngine } from "../AlarmEngine";
import { AlarmFormat } from "../AlarmFormat";
import type { IArmedAlarm } from "../Types";

export class ListTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "List";
	public readonly Description = "예약·완료·지나감 알람 목록과 남은 시간(RemainingMs)을 돌려준다.";
	public readonly InputSchema = { type: "object", properties: {} };
	// 상태를 바꾸지 않는 조회 전용. 승인 프롬프트 없이 불려야 쓸모가 있다.
	public readonly Annotations = { ReadOnly: true };
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
	// 상태별로 갈라 돌려준다. 남은 시간은 저장값이 아니라 지금 파생한 값이다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const now = Date.now();
		const all = this.engine_.Store.ListArmed();
		const pick = (_state: string): Array<Record<string, unknown>> =>
		{
			return all.filter((_a: IArmedAlarm) => _a.State === _state).map((_a: IArmedAlarm) => AlarmFormat.Summary(_a, now));
		};
		const armed = pick("Armed");
		const done = pick("Fired");
		const missed = pick("Missed");
		const canceled = pick("Canceled");
		return Promise.resolve({
			Ok: true,
			NowMs: now,
			Counts: { Armed: armed.length, Done: done.length, Missed: missed.length, Canceled: canceled.length },
			Armed: armed,
			Done: done,
			Missed: missed,
			Canceled: canceled,
			Groups: this.engine_.Store.ListGroups().map((_g) => ({ Name: _g.Name, Count: _g.Specs.length })),
		});
	}
}
