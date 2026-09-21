/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Schedule. croner 감싸기 + 소유자별 일괄 해제.
*/

import { Cron } from "croner";
import type { IDisposable } from "@scouter/gui";

interface IScheduleJob
{
	Owner: string;
	Stop: () => void;
	Stopped: boolean;
}

export class Schedule
{
	// ==================== 정적 ====================
	private static readonly s_jobs_ = new Map<string, IScheduleJob[]>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// cron 등록. 소유자 언로드 시 RemoveAll.
	// @param _owner: 소유자 (PluginId 등)
	// @param _expr: cron 식
	// @param _fn: 콜백
	public static Add(_owner: string, _expr: string, _fn: () => void): IDisposable
	{
		const job = new Cron(_expr, _fn);
		return Schedule.Register(_owner, () => { job.stop(); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 간격 등록. cron과 같은 목록에 담기므로 RemoveAll로도 정리된다.
	// @param _owner: 소유자
	// @param _ms: 간격
	// @param _fn: 콜백
	public static Interval(_owner: string, _ms: number, _fn: () => void): IDisposable
	{
		const timer = setInterval(_fn, _ms);
		return Schedule.Register(_owner, () => { clearInterval(timer); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 소유자 작업을 전부 멈춘다. 이미 해제된 작업은 건너뛴다.
	// @param _owner: 소유자
	public static RemoveAll(_owner: string): void
	{
		const list = Schedule.s_jobs_.get(_owner);
		if (list === undefined)
			return;
		Schedule.s_jobs_.delete(_owner);
		for (const job of [...list])
			Schedule.Cancel(job);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 소유자가 붙잡고 있는 살아있는 작업 수. 누수 진단·테스트용.
	// @param _owner: 소유자
	public static CountOf(_owner: string): number
	{
		return Schedule.s_jobs_.get(_owner)?.length ?? 0;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 작업을 소유자 목록에 담고 해제자를 돌려준다. 해제는 몇 번 불러도 안전하다.
	// @param _owner: 소유자
	// @param _stop: 실제 중지 동작
	private static Register(_owner: string, _stop: () => void): IDisposable
	{
		const job: IScheduleJob = { Owner: _owner, Stop: _stop, Stopped: false };
		let list = Schedule.s_jobs_.get(_owner);
		if (list === undefined)
		{
			list = [];
			Schedule.s_jobs_.set(_owner, list);
		}
		list.push(job);
		return {
			Dispose: () =>
			{
				Schedule.Cancel(job);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 작업 1개를 멈추고 목록에서 뺀다. 중복 호출은 조용히 넘긴다(멱등).
	// @param _job: 작업
	private static Cancel(_job: IScheduleJob): void
	{
		if (_job.Stopped)
			return;
		_job.Stopped = true;
		_job.Stop();
		const list = Schedule.s_jobs_.get(_job.Owner);
		if (list === undefined)
			return;
		const idx = list.indexOf(_job);
		if (idx >= 0)
			list.splice(idx, 1);
		if (list.length === 0)
			Schedule.s_jobs_.delete(_job.Owner);
	}
}
