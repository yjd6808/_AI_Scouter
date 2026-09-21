/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: AlarmEngine. 예약·tick·발사·복원 판정 담당. UI/IO 의존이 없고 시계(INowSource)와
	      발사 싱크까지 주입받아 실시간 대기 없이 단위 테스트할 수 있다.
*/

import { AlarmStore, CloneSpec } from "./AlarmStore";
import type { IAlarmGroup, IAlarmLogger, IAlarmOptions, IAlarmSpec, IArmedAlarm, IGroupArmReport, INowSource, IRestoreReport, TAlarmResult, TArmOutcome, TDueOutcome, TFireSink, TMissedSink } from "./Types";

const kClockBackToleranceMs = 2000;
const kPruneIntervalMs = 3600000;
const kHourMinuteRe = /^(\d{1,2}):(\d{2})$/;
const kDateTimeRe = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/;

export interface IAtTimeParts
{
	HasDate: boolean;
	Year: number;
	Month: number;
	Day: number;
	Hour: number;
	Minute: number;
}

export interface IAlarmEngineDeps
{
	Store: AlarmStore;
	Now: INowSource;
	Fire: TFireSink;
	Missed: TMissedSink;
	Options: IAlarmOptions;
	Logger: IAlarmLogger;
}

//////////////////////////////////////////////////////////////////////////////////////
// "HH:mm" 또는 "YYYY-MM-DD HH:mm"을 분해한다. 형식·범위가 어긋나면 null.
// @param _text: 시각 문자열
export function ParseAtTime(_text: string): IAtTimeParts | null
{
	const text = _text.trim();
	const short = kHourMinuteRe.exec(text);
	if (short !== null)
	{
		const hour = Number(short[1]);
		const minute = Number(short[2]);
		if (hour > 23 || minute > 59)
			return null;
		return { HasDate: false, Year: 0, Month: 0, Day: 0, Hour: hour, Minute: minute };
	}
	const full = kDateTimeRe.exec(text);
	if (full === null)
		return null;
	const year = Number(full[1]);
	const month = Number(full[2]);
	const day = Number(full[3]);
	const hour = Number(full[4]);
	const minute = Number(full[5]);
	if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59)
		return null;
	return { HasDate: true, Year: year, Month: month, Day: day, Hour: hour, Minute: minute };
}

//////////////////////////////////////////////////////////////////////////////////////
// 스펙과 기준 시각으로 마감 시각(절대 epoch ms)을 구한다. 저장되는 유일한 시간 값이다.
// 상대 알람은 기준 시각에서 다시 계산하고, 날짜 없는 절대 알람은 기준 시각의 날짜에 붙인다.
// @param _spec: 알람 스펙
// @param _baseMs: 기준 시각(예약 시점)
export function ResolveDueAtMs(_spec: IAlarmSpec, _baseMs: number): TDueOutcome
{
	if (_spec.Kind === "After")
	{
		const sec = Math.round(_spec.OffsetSec);
		if (!Number.isFinite(sec) || sec <= 0)
			return { Ok: false, Error: "상대 알람은 1초 이상이어야 한다" };
		return { Ok: true, DueAtMs: _baseMs + sec * 1000 };
	}
	const parts = ParseAtTime(_spec.AtTime);
	if (parts === null)
		return { Ok: false, Error: `시각 형식 오류: ${_spec.AtTime}` };
	const base = new Date(_baseMs);
	const year = parts.HasDate ? parts.Year : base.getFullYear();
	const month = parts.HasDate ? parts.Month - 1 : base.getMonth();
	const day = parts.HasDate ? parts.Day : base.getDate();
	const due = new Date(year, month, day, parts.Hour, parts.Minute, 0, 0).getTime();
	if (due > _baseMs)
		return { Ok: true, DueAtMs: due };
	if (!_spec.RollToNextDay)
		return { Ok: false, Error: `이미 지난 시각: ${_spec.AtTime}` };
	return { Ok: true, DueAtMs: new Date(year, month, day + 1, parts.Hour, parts.Minute, 0, 0).getTime() };
}

//////////////////////////////////////////////////////////////////////////////////////
// 핵심 판정식. 아직 울리지 않은 예약의 마감이 지났는지 본다.
// 복원 시에는 "놓침" 후보, 평소 tick에서는 "발사" 대상이 된다.
// @param _alarm: 예약 인스턴스
// @param _nowMs: 현재 시각
export function IsDuePassed(_alarm: IArmedAlarm, _nowMs: number): boolean
{
	return _alarm.State === "Armed" && _alarm.DueAtMs <= _nowMs && _alarm.FiredAtMs === 0;
}

export class AlarmEngine
{
	// ==================== 멤버 ====================
	private readonly store_: AlarmStore;
	private readonly now_: INowSource;
	private readonly fire_: TFireSink;
	private readonly missed_: TMissedSink;
	private readonly options_: IAlarmOptions;
	private readonly logger_: IAlarmLogger;
	private lastPruneMs_ = 0;
	private ticking_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소·시계·발사 싱크·설정 getter를 주입받는다. 전부 대역으로 바꿀 수 있다.
	// @param _deps: 주입 묶음
	public constructor(_deps: IAlarmEngineDeps)
	{
		this.store_ = _deps.Store;
		this.now_ = _deps.Now;
		this.fire_ = _deps.Fire;
		this.missed_ = _deps.Missed;
		this.options_ = _deps.Options;
		this.logger_ = _deps.Logger;
	}

	// ==================== 속성 ====================
	public get Store(): AlarmStore { return this.store_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 앱이 켜질 때 한 번 호출한다. 타이머를 되살리는 게 아니라 지나간 예약을 분류만 한다.
	// 시계가 역행했으면 판정을 보류하고 경고만 남긴다.
	public Restore(): IRestoreReport
	{
		const now = this.now_.Now();
		const report: IRestoreReport = { Missed: [], Grace: [], ClockBack: false, Notified: 0, Pruned: 0 };
		const lastSeen = this.store_.LastSeenAtMs;
		report.Pruned = this.store_.PruneHistory(now, this.options_.HistoryKeepDays());
		this.lastPruneMs_ = now;
		this.CloseDangling();
		if (lastSeen > 0 && now < lastSeen - kClockBackToleranceMs)
		{
			this.logger_.Warn("[InstantAlarm] 시계 역행 감지. 놓침 판정을 보류한다.", { Now: now, LastSeen: lastSeen });
			report.ClockBack = true;
			this.store_.TouchSeen(now);
			this.store_.Save();
			return report;
		}
		const graceMs = Math.max(0, this.options_.MissedGraceSec()) * 1000;
		for (const alarm of this.store_.ListArmed())
		{
			if (!IsDuePassed(alarm, now))
				continue;
			if (now - alarm.DueAtMs <= graceMs)
			{
				report.Grace.push(alarm);
				continue;
			}
			alarm.State = "Missed";
			report.Missed.push(alarm);
		}
		this.store_.TouchSeen(now);
		this.store_.Save();
		report.Notified = this.NotifyMissed();
		return report;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 알람 1건을 지금 기준으로 예약한다. 스펙은 스냅샷을 떠서 보관한다.
	// @param _spec: 알람 스펙
	// @param _groupName: 소속 그룹 이름(없으면 "")
	public ArmSpec(_spec: IAlarmSpec, _groupName: string): TArmOutcome
	{
		return this.CreateArmed(_spec, _groupName, this.now_.Now());
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹을 통째로 예약한다. 기준 시각 하나로 전부 계산해 같은 순간에 맞춘다.
	// 상대 알람은 예약 시점부터 다시 세고, 날짜 없는 절대 알람은 예약일 날짜에 붙는다.
	// @param _group: 알람 그룹
	public ArmGroup(_group: IAlarmGroup): IGroupArmReport
	{
		const baseMs = this.now_.Now();
		const report: IGroupArmReport = { GroupName: _group.Name, Armed: [], Errors: [] };
		for (const spec of _group.Specs)
		{
			const outcome = this.CreateArmed(spec, _group.Name, baseMs);
			if (outcome.Ok)
				report.Armed.push(outcome.Alarm);
			else
				report.Errors.push(`${spec.Title.length > 0 ? spec.Title : spec.Id}: ${outcome.Error}`);
		}
		return report;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약을 취소한다. 이미 울렸거나 없는 건은 false.
	// @param _id: 예약 인스턴스 Id
	public Cancel(_id: string): boolean
	{
		const alarm = this.store_.FindArmed(_id);
		if (alarm === null || alarm.State !== "Armed")
			return false;
		alarm.State = "Canceled";
		this.store_.UpdateArmed(alarm);
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 Id를 유지한 채 마감 시각만 뒤로 민다. 취소 후 재예약과 달리 Id·이력이 끊기지 않는다.
	// 마감을 이미 넘겼지만 아직 안 울린 건은 지금을 기준으로 민다(과거로 미루지 않는다).
	// @param _id: 예약 인스턴스 Id
	// @param _deltaSec: 미룰 초
	public Postpone(_id: string, _deltaSec: number): TArmOutcome
	{
		const alarm = this.store_.FindArmed(_id);
		if (alarm === null || alarm.State !== "Armed")
			return { Ok: false, Error: "미룰 수 있는 예약이 아니다" };
		const sec = Math.round(_deltaSec);
		if (!Number.isFinite(sec) || sec <= 0)
			return { Ok: false, Error: "미루는 시간은 1초 이상이어야 한다" };
		const now = this.now_.Now();
		alarm.DueAtMs = Math.max(alarm.DueAtMs, now) + sec * 1000;
		this.store_.UpdateArmed(alarm);
		return { Ok: true, Alarm: alarm };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 Id를 유지한 채 스펙을 갈아끼운다. 마감 시각은 지금 기준으로 다시 계산한다.
	// 계산이 실패하면 아무것도 바꾸지 않는다 — 수정 실패가 기존 예약을 날리면 안 된다.
	// @param _id: 예약 인스턴스 Id
	// @param _spec: 새 스펙
	public Reschedule(_id: string, _spec: IAlarmSpec): TArmOutcome
	{
		const alarm = this.store_.FindArmed(_id);
		if (alarm === null || alarm.State !== "Armed")
			return { Ok: false, Error: "수정할 수 있는 예약이 아니다" };
		const now = this.now_.Now();
		const due = ResolveDueAtMs(_spec, now);
		if (!due.Ok)
		{
			this.logger_.Warn(`[InstantAlarm] 수정 거부: ${due.Error}`, { Id: _id });
			return { Ok: false, Error: due.Error };
		}
		alarm.SpecId = _spec.Id;
		alarm.Spec = CloneSpec(_spec);
		alarm.ArmedAtMs = now;
		alarm.DueAtMs = due.DueAtMs;
		this.store_.UpdateArmed(alarm);
		return { Ok: true, Alarm: alarm };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 주기 호출. 마감이 지난 예약을 순서대로 발사한다. 겹쳐 들어오면 무시한다.
	public async TickAsync(): Promise<void>
	{
		if (this.ticking_)
			return;
		this.ticking_ = true;
		try
		{
			const now = this.now_.Now();
			for (const alarm of this.store_.ListArmed())
			{
				if (IsDuePassed(alarm, now))
					await this.FireAsync(alarm, now);
			}
			this.store_.TouchSeen(now);
			if (now - this.lastPruneMs_ >= kPruneIntervalMs)
			{
				this.store_.PruneHistory(now, this.options_.HistoryKeepDays());
				this.lastPruneMs_ = now;
			}
		}
		finally
		{
			this.ticking_ = false;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 남은 시간(ms). 저장하지 않고 항상 DueAtMs에서 파생한다. 지났으면 음수.
	// @param _alarm: 예약 인스턴스
	public RemainingMs(_alarm: IArmedAlarm): number
	{
		return _alarm.DueAtMs - this.now_.Now();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 긴급 강조 대상인지. 남은 시간이 UrgentSec 이내면 true.
	// @param _alarm: 예약 인스턴스
	public IsUrgent(_alarm: IArmedAlarm): boolean
	{
		const remain = this.RemainingMs(_alarm);
		return remain >= 0 && remain <= Math.max(0, this.options_.UrgentSec()) * 1000;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 아직 울리지 않은 예약만 마감 시각순으로 돌려준다.
	public PendingList(): IArmedAlarm[]
	{
		return this.store_.ListArmed().filter((_a) => _a.State === "Armed");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 스펙을 예약 인스턴스로 만들어 즉시 저장한다. 시각 계산이 실패하면 예약하지 않는다.
	// @param _spec: 알람 스펙
	// @param _groupName: 소속 그룹 이름
	// @param _baseMs: 기준 시각
	private CreateArmed(_spec: IAlarmSpec, _groupName: string, _baseMs: number): TArmOutcome
	{
		const due = ResolveDueAtMs(_spec, _baseMs);
		if (!due.Ok)
		{
			this.logger_.Warn(`[InstantAlarm] 예약 거부: ${due.Error}`, { SpecId: _spec.Id });
			return { Ok: false, Error: due.Error };
		}
		const alarm: IArmedAlarm = {
			Id: this.store_.NewId("armed"),
			SpecId: _spec.Id,
			Spec: CloneSpec(_spec),
			GroupName: _groupName,
			ArmedAtMs: _baseMs,
			DueAtMs: due.DueAtMs,
			State: "Armed",
			FiredAtMs: 0,
			Result: "",
			MissedNotified: false,
		};
		this.store_.AddArmed(alarm);
		return { Ok: true, Alarm: alarm };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 알람 1건을 발사한다. 순서가 중요하다 — 상태를 먼저 Fired로 바꿔 저장한 뒤에
	// 싱크를 부른다. 응답을 기다리다 앱이 죽어도 중복 발사되지 않는다.
	// @param _alarm: 예약 인스턴스
	// @param _nowMs: 발사 시각
	private async FireAsync(_alarm: IArmedAlarm, _nowMs: number): Promise<void>
	{
		_alarm.State = "Fired";
		_alarm.FiredAtMs = _nowMs;
		_alarm.Result = "";
		this.store_.UpdateArmed(_alarm);
		let result: TAlarmResult = "closed";
		try
		{
			result = await this.fire_(_alarm);
		}
		catch (_e)
		{
			this.logger_.Warn(`[InstantAlarm] 발사 실패: ${String(_e)}`, { Id: _alarm.Id });
		}
		_alarm.Result = result;
		this.store_.UpdateArmed(_alarm);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 울렸지만 결과를 못 받고 종료된 건을 닫힌 것으로 마감한다. 놓침이 아니다.
	private CloseDangling(): void
	{
		let changed = false;
		for (const alarm of this.store_.ListArmed())
		{
			if (alarm.State !== "Fired" || alarm.FiredAtMs <= 0 || alarm.Result.length > 0)
				continue;
			alarm.Result = "closed";
			changed = true;
		}
		if (changed)
			this.store_.Save();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 아직 안내하지 않은 놓침 건을 한 번만 안내하고 마크한다. 안내한 개수를 돌려준다.
	// silent 정책이면 안내도 마크도 하지 않는다.
	private NotifyMissed(): number
	{
		const pending = this.store_.ListArmed().filter((_a) => _a.State === "Missed" && !_a.MissedNotified);
		if (pending.length === 0 || this.options_.MissedPolicy() !== "toast")
			return 0;
		this.missed_(pending.slice(0, Math.max(1, this.options_.MissedListMax())), pending.length);
		for (const alarm of pending)
			alarm.MissedNotified = true;
		this.store_.Save();
		return pending.length;
	}
}
