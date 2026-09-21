/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: AlarmFormat. 화면·Tool이 함께 쓰는 표시 문자열 변환기. 상태를 갖지 않는 순수 변환만 담는다.
	      남은 시간은 여기서 계산하지 않는다 — 항상 호출자가 engine.RemainingMs로 파생해서 넘긴다.
*/

import type { IArmedAlarm } from "./Types";

const kHourMs = 3600000;
const kMinuteMs = 60000;
const kSecondMs = 1000;

//////////////////////////////////////////////////////////////////////////////////////
// 두 자리로 0을 채운다.
// @param _value: 숫자
function Pad2(_value: number): string
{
	return _value < 10 ? `0${_value}` : String(_value);
}

export class AlarmFormat
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 절대 시각을 "HH:mm" 또는 날짜가 다르면 "M/D HH:mm"으로 만든다.
	// @param _atMs: 절대 시각
	// @param _nowMs: 기준 시각
	public static Clock(_atMs: number, _nowMs: number): string
	{
		const at = new Date(_atMs);
		const now = new Date(_nowMs);
		const hhmm = `${Pad2(at.getHours())}:${Pad2(at.getMinutes())}`;
		if (at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate())
			return hhmm;
		return `${at.getMonth() + 1}/${at.getDate()} ${hhmm}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 절대 시각을 입력란용 "YYYY-MM-DD"로 만든다. 수정 폼 채우기에 쓴다.
	// @param _atMs: 절대 시각
	public static DateInput(_atMs: number): string
	{
		const at = new Date(_atMs);
		return `${String(at.getFullYear())}-${Pad2(at.getMonth() + 1)}-${Pad2(at.getDate())}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 절대 시각을 입력란용 "HH:mm"으로 만든다. 날짜는 버린다.
	// @param _atMs: 절대 시각
	public static TimeInput(_atMs: number): string
	{
		const at = new Date(_atMs);
		return `${Pad2(at.getHours())}:${Pad2(at.getMinutes())}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 남은 시간(ms)을 "HH:mm:ss"로 만든다. 음수면 "00:00:00".
	// @param _remainMs: 남은 시간
	public static Remain(_remainMs: number): string
	{
		const total = Math.max(0, Math.floor(_remainMs / kSecondMs));
		const hour = Math.floor(total / 3600);
		const minute = Math.floor((total % 3600) / 60);
		const second = total % 60;
		return `${Pad2(hour)}:${Pad2(minute)}:${Pad2(second)}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 지나간 시간을 사람 말로 만든다. "방금" / "12분 경과" / "2시간 경과".
	// @param _elapsedMs: 지나간 시간
	public static Elapsed(_elapsedMs: number): string
	{
		const elapsed = Math.max(0, _elapsedMs);
		if (elapsed < kMinuteMs)
			return "방금";
		if (elapsed < kHourMs)
			return `${Math.floor(elapsed / kMinuteMs)}분 경과`;
		return `${Math.floor(elapsed / kHourMs)}시간 경과`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태를 배지 문구로 만든다. 결과까지 합쳐 사람이 읽을 한 덩어리로 준다.
	// @param _alarm: 예약 인스턴스
	public static StateText(_alarm: IArmedAlarm): string
	{
		switch (_alarm.State)
		{
			case "Armed": return "예약";
			case "Missed": return "지나감";
			case "Canceled": return "취소";
			case "Fired": return _alarm.Result === "timeout" || _alarm.Result === "closed" ? "완료" : "완료·확인함";
			default: return "대기";
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태에 맞는 Badge Variant를 고른다.
	// @param _alarm: 예약 인스턴스
	public static StateVariant(_alarm: IArmedAlarm): string
	{
		switch (_alarm.State)
		{
			case "Armed": return "Info";
			case "Missed": return "Error";
			case "Fired": return "Success";
			default: return "Warn";
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool 응답용 요약 객체를 만든다. 남은 시간은 여기서 파생해 함께 싣는다.
	// @param _alarm: 예약 인스턴스
	// @param _nowMs: 기준 시각
	public static Summary(_alarm: IArmedAlarm, _nowMs: number): Record<string, unknown>
	{
		return {
			Id: _alarm.Id,
			Title: _alarm.Spec.Title,
			Message: _alarm.Spec.Message,
			GroupName: _alarm.GroupName,
			State: _alarm.State,
			Result: _alarm.Result,
			DueAtMs: _alarm.DueAtMs,
			DueText: AlarmFormat.Clock(_alarm.DueAtMs, _nowMs),
			RemainingMs: _alarm.DueAtMs - _nowMs,
			RemainText: AlarmFormat.Remain(_alarm.DueAtMs - _nowMs),
		};
	}
}
