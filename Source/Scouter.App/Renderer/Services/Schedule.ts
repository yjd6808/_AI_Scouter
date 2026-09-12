/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Schedule. croner 감싸기 + 소유자별 일괄 해제.
*/

import { Cron } from "croner";
import type { IDisposable } from "@scouter/gui";

export class Schedule
{
	// ==================== 정적 ====================
	private static readonly s_jobs_ = new Map<string, Cron[]>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// cron 등록. 소유자 언로드 시 RemoveAll.
	// @param _owner: 소유자 (PluginId 등)
	// @param _expr: cron 식
	// @param _fn: 콜백
	public static Add(_owner: string, _expr: string, _fn: () => void): IDisposable
	{
		const job = new Cron(_expr, _fn);
		let list = Schedule.s_jobs_.get(_owner);
		if (list === undefined)
		{
			list = [];
			Schedule.s_jobs_.set(_owner, list);
		}
		list.push(job);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				job.stop();
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 간격 등록.
	// @param _owner: 소유자
	// @param _ms: 간격
	// @param _fn: 콜백
	public static Interval(_owner: string, _ms: number, _fn: () => void): IDisposable
	{
		const timer = setInterval(_fn, _ms);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				clearInterval(timer);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 소유자 작업을 전부 멈춘다.
	// @param _owner: 소유자
	public static RemoveAll(_owner: string): void
	{
		const list = Schedule.s_jobs_.get(_owner);
		if (list === undefined)
			return;
		for (const job of list)
			job.stop();
		Schedule.s_jobs_.delete(_owner);
	}
}
