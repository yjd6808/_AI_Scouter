/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScheduleCalc. 예약 시각 계산기. 상태가 없는 순수 계산만 담아 시계를 주입하지 않고도 테스트한다.
	      반복 규칙은 모드별로 고정이다 — "시간 뒤"는 같은 간격마다(예정 시각 기준),
	      "특정 시각"은 매일 같은 시각. 지나간 회차는 따라잡지 않고 다음 미래 회차로 건너뛴다.
*/

import type { IScriptSchedule, TDueOutcome } from "./Types";

const kSecondMs = 1000;
const kDayMs = 86400000;
const kMaxRollDays = 4000;
const kHourMinuteRe = /^(\d{1,2}):(\d{2})$/;
const kDateTimeRe = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/;
const kDateRe = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

export interface IAtTimeParts
{
	HasDate: boolean;
	Year: number;
	Month: number;
	Day: number;
	Hour: number;
	Minute: number;
}

//////////////////////////////////////////////////////////////////////////////////////
// 두 자리로 0을 채운다.
// @param _value: 숫자
function Pad2(_value: number): string
{
	return _value < 10 ? `0${_value}` : String(_value);
}

export class ScheduleCalc
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// "HH:mm" 또는 "YYYY-MM-DD HH:mm"을 분해한다. 형식·범위가 어긋나거나 없는 날짜(2월 31일)면 null.
	// @param _text: 시각 문자열
	public static ParseAtTime(_text: string): IAtTimeParts | null
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
		const parts: IAtTimeParts = {
			HasDate: true,
			Year: Number(full[1]),
			Month: Number(full[2]),
			Day: Number(full[3]),
			Hour: Number(full[4]),
			Minute: Number(full[5]),
		};
		if (parts.Hour > 23 || parts.Minute > 59 || !ScheduleCalc.DateExists(parts.Year, parts.Month, parts.Day))
			return null;
		return parts;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// "YYYY-MM-DD"가 실제로 있는 날짜인지 본다.
	// @param _text: 날짜 문자열
	public static IsValidDate(_text: string): boolean
	{
		const match = kDateRe.exec(_text.trim());
		if (match === null)
			return false;
		return ScheduleCalc.DateExists(Number(match[1]), Number(match[2]), Number(match[3]));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약을 처음 걸 때의 실행 시각을 구한다. 예약이 꺼져 있으면 0(예약 없음)이다.
	// 날짜를 준 특정 시각이 이미 지났으면 반복일 때만 다음 날로 넘기고, 아니면 거부한다.
	// 날짜 없는 특정 시각은 오늘 그 시각이 지났으면 내일로 넘긴다.
	// @param _schedule: 예약 설정
	// @param _nowMs: 기준 시각
	public static FirstDue(_schedule: IScriptSchedule, _nowMs: number): TDueOutcome
	{
		if (!_schedule.Enabled)
			return { Ok: true, DueAtMs: 0 };
		if (_schedule.Kind === "After")
		{
			const sec = Math.round(_schedule.OffsetSec);
			if (!Number.isFinite(sec) || sec < 1)
				return { Ok: false, Error: "시간 뒤 예약은 1초 이상이어야 합니다." };
			return { Ok: true, DueAtMs: _nowMs + sec * kSecondMs };
		}
		const parts = ScheduleCalc.ParseAtTime(_schedule.AtTime);
		if (parts === null)
			return { Ok: false, Error: `시각 형식이 잘못됐습니다: "${_schedule.AtTime}". HH:mm 또는 YYYY-MM-DD HH:mm 형식이어야 합니다.` };
		const base = new Date(_nowMs);
		const year = parts.HasDate ? parts.Year : base.getFullYear();
		const month = parts.HasDate ? parts.Month - 1 : base.getMonth();
		const day = parts.HasDate ? parts.Day : base.getDate();
		const due = new Date(year, month, day, parts.Hour, parts.Minute, 0, 0).getTime();
		if (due > _nowMs)
			return { Ok: true, DueAtMs: due };
		if (parts.HasDate && !_schedule.Repeat)
			return { Ok: false, Error: `이미 지난 시각입니다: ${_schedule.AtTime}. 더 뒤 시각을 고르거나 반복 수행을 켜세요.` };
		return { Ok: true, DueAtMs: ScheduleCalc.RollDaily(due, _nowMs) };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 회차 1번을 처리한 뒤의 다음 실행 시각을 구한다. 반복이 아니면 0(예약 끝)이다.
	// "시간 뒤"는 예정 시각에 간격을 더한다(실행이 끝난 시각 기준이 아니다). 지난 회차는 건너뛴다.
	// @param _schedule: 예약 설정
	// @param _dueAtMs: 방금 처리한 회차의 예정 시각
	// @param _nowMs: 기준 시각
	public static NextAfterFire(_schedule: IScriptSchedule, _dueAtMs: number, _nowMs: number): number
	{
		if (!_schedule.Enabled || !_schedule.Repeat)
			return 0;
		if (_schedule.Kind === "After")
		{
			const step = Math.max(1, Math.round(_schedule.OffsetSec)) * kSecondMs;
			if (_dueAtMs + step > _nowMs)
				return _dueAtMs + step;
			const passed = Math.floor((_nowMs - _dueAtMs) / step) + 1;
			return _dueAtMs + passed * step;
		}
		return ScheduleCalc.RollDaily(_dueAtMs, _nowMs);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 설정을 사람이 읽을 문구로 만든다. 목록 툴팁과 Tool 응답이 함께 쓴다.
	// @param _schedule: 예약 설정
	public static Describe(_schedule: IScriptSchedule): string
	{
		if (!_schedule.Enabled)
			return "예약 없음";
		if (_schedule.Kind === "After")
		{
			const span = ScheduleCalc.SpanText(Math.max(1, Math.round(_schedule.OffsetSec)));
			return _schedule.Repeat ? `${span} 뒤, 이후 ${span}마다 반복` : `${span} 뒤 1회`;
		}
		const parts = ScheduleCalc.ParseAtTime(_schedule.AtTime);
		if (parts === null)
			return `특정 시각 ${_schedule.AtTime}`;
		const hhmm = `${Pad2(parts.Hour)}:${Pad2(parts.Minute)}`;
		if (_schedule.Repeat)
			return parts.HasDate ? `${parts.Year}-${Pad2(parts.Month)}-${Pad2(parts.Day)}부터 매일 ${hhmm}` : `매일 ${hhmm}`;
		return parts.HasDate ? `${parts.Year}-${Pad2(parts.Month)}-${Pad2(parts.Day)} ${hhmm} 1회` : `${hhmm} 1회`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 초를 "1시간 5분 3초"처럼 0인 단위를 뺀 문구로 만든다.
	// @param _seconds: 초
	public static SpanText(_seconds: number): string
	{
		const total = Math.max(0, Math.round(_seconds));
		const hour = Math.floor(total / 3600);
		const minute = Math.floor((total % 3600) / 60);
		const second = total % 60;
		const parts: string[] = [];
		if (hour > 0)
			parts.push(`${hour}시간`);
		if (minute > 0)
			parts.push(`${minute}분`);
		if (second > 0 || parts.length === 0)
			parts.push(`${second}초`);
		return parts.join(" ");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 같은 시·분을 유지한 채 하루씩 넘겨 기준 시각보다 뒤인 첫 시각을 구한다.
	// 날짜 산술로 넘기므로 하루 길이가 24시간이 아닌 날에도 시·분이 흔들리지 않는다.
	// @param _fromMs: 시작 시각(이 시각의 시·분을 쓴다)
	// @param _nowMs: 기준 시각
	private static RollDaily(_fromMs: number, _nowMs: number): number
	{
		const from = new Date(_fromMs);
		let skip = Math.max(1, Math.floor((_nowMs - _fromMs) / kDayMs));
		for (let idx = 0; idx < kMaxRollDays; ++idx)
		{
			const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + skip, from.getHours(), from.getMinutes(), 0, 0).getTime();
			if (next > _nowMs)
				return next;
			++skip;
		}
		return _nowMs + kDayMs;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 연·월·일이 실제 달력에 있는지 본다.
	// @param _year: 연
	// @param _month: 월(1~12)
	// @param _day: 일
	private static DateExists(_year: number, _month: number, _day: number): boolean
	{
		if (_month < 1 || _month > 12 || _day < 1 || _day > 31)
			return false;
		const date = new Date(_year, _month - 1, _day);
		return date.getFullYear() === _year && date.getMonth() === _month - 1 && date.getDate() === _day;
	}
}
