/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScriptFormat. 화면·Tool이 함께 쓰는 표시 문자열 변환기. 상태를 갖지 않는 순수 변환만 담는다.
	      남은 시간은 저장하지 않는다 — 호출자가 기준 시각을 넘겨 그때그때 파생한다.
*/

import { ScheduleCalc } from "./ScheduleCalc";
import type { IRunRecord, IScriptEntry, TEntryState } from "./Types";

const kSecondMs = 1000;

//////////////////////////////////////////////////////////////////////////////////////
// 두 자리로 0을 채운다.
// @param _value: 숫자
function Pad2(_value: number): string
{
	return _value < 10 ? `0${_value}` : String(_value);
}

export class ScriptFormat
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 시간(ms)을 "HH:mm:ss"로 만든다. 하루를 넘으면 "N일 HH:mm:ss". 음수면 0으로 본다.
	// @param _ms: 시간
	public static Span(_ms: number): string
	{
		const total = Math.max(0, Math.floor(_ms / kSecondMs));
		const day = Math.floor(total / 86400);
		const hour = Math.floor((total % 86400) / 3600);
		const minute = Math.floor((total % 3600) / 60);
		const second = total % 60;
		const clock = `${Pad2(hour)}:${Pad2(minute)}:${Pad2(second)}`;
		return day > 0 ? `${day}일 ${clock}` : clock;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 절대 시각을 "HH:mm:ss" 또는 날짜가 다르면 "M/D HH:mm"으로 만든다.
	// @param _atMs: 절대 시각
	// @param _nowMs: 기준 시각
	public static Clock(_atMs: number, _nowMs: number): string
	{
		if (_atMs <= 0)
			return "";
		const at = new Date(_atMs);
		const now = new Date(_nowMs);
		if (at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate())
			return `${Pad2(at.getHours())}:${Pad2(at.getMinutes())}:${Pad2(at.getSeconds())}`;
		return `${at.getMonth() + 1}/${at.getDate()} ${Pad2(at.getHours())}:${Pad2(at.getMinutes())}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 절대 시각을 입력란용 "YYYY-MM-DD"로 만든다.
	// @param _atMs: 절대 시각
	public static DateInput(_atMs: number): string
	{
		const at = new Date(_atMs);
		return `${String(at.getFullYear())}-${Pad2(at.getMonth() + 1)}-${Pad2(at.getDate())}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 결과를 짧은 문구로 만든다. 기록이 없으면 "대기".
	// @param _record: 마지막 실행 기록
	public static ResultText(_record: IRunRecord | null): string
	{
		if (_record === null)
			return "대기";
		switch (_record.Result)
		{
			case "Running": return "실행 중";
			case "Success": return `완료 (${_record.ExitCode})`;
			case "Failed": return `실패 (${_record.ExitCode})`;
			case "Stopped": return "중지됨";
			default: return "오류";
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록 오른쪽 "남은 시간" 칸 문구. 실행 중이면 경과, 예약이면 남은 시간, 아니면 마지막 결과.
	// @param _entry: 항목
	// @param _state: 항목 상태
	// @param _nowMs: 기준 시각
	public static RemainText(_entry: IScriptEntry, _state: TEntryState, _nowMs: number): string
	{
		if (_state === "Running" && _entry.LastRun !== null)
			return `실행 중 ${ScriptFormat.Span(_nowMs - _entry.LastRun.StartedAtMs)}`;
		if (_state === "Scheduled")
			return ScriptFormat.Span(_entry.NextDueAtMs - _nowMs);
		if (_entry.MissedAtMs > 0)
			return "지나감";
		return ScriptFormat.ResultText(_entry.LastRun);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 경로에서 파일 이름만 뽑는다.
	// @param _path: 경로
	public static FileName(_path: string): string
	{
		const parts = _path.split(/[\\/]/);
		return parts[parts.length - 1] ?? _path;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 툴팁 문구. 경로·예약·마지막 실행을 여러 줄로 묶는다.
	// @param _entry: 항목
	// @param _nowMs: 기준 시각
	public static Tip(_entry: IScriptEntry, _nowMs: number): string
	{
		const lines = [_entry.Path, `예약: ${ScheduleCalc.Describe(_entry.Schedule)}`];
		if (_entry.Schedule.Enabled)
			lines.push(_entry.KeepAfterBoot ? "부팅 후에도 예약 유지" : "부팅하면 예약 해제");
		if (_entry.NextDueAtMs > 0)
			lines.push(`다음 실행: ${ScriptFormat.Clock(_entry.NextDueAtMs, _nowMs)}`);
		if (_entry.LastRun !== null)
			lines.push(`마지막 실행: ${ScriptFormat.Clock(_entry.LastRun.StartedAtMs, _nowMs)} · ${ScriptFormat.ResultText(_entry.LastRun)}`);
		return lines.join("\n");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 기록 요약 객체. Tool 응답용이다.
	// @param _record: 실행 기록
	public static RunSummary(_record: IRunRecord | null): Record<string, unknown> | null
	{
		if (_record === null)
			return null;
		return {
			RunId: _record.RunId,
			Trigger: _record.Trigger,
			Result: _record.Result,
			ExitCode: _record.ExitCode,
			StartedAtMs: _record.StartedAtMs,
			EndedAtMs: _record.EndedAtMs,
			DurationMs: _record.EndedAtMs > 0 ? _record.EndedAtMs - _record.StartedAtMs : 0,
			Args: [..._record.Args],
			Error: _record.Error,
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목 요약 객체. Tool 응답용이다. 남은 시간은 여기서 파생해 함께 싣는다.
	// @param _entry: 항목
	// @param _state: 항목 상태
	// @param _nowMs: 기준 시각
	public static Summary(_entry: IScriptEntry, _state: TEntryState, _nowMs: number): Record<string, unknown>
	{
		const remain = _entry.NextDueAtMs > 0 ? Math.max(0, _entry.NextDueAtMs - _nowMs) : 0;
		return {
			Id: _entry.Id,
			Title: _entry.Title,
			ScriptName: ScriptFormat.FileName(_entry.Path),
			Path: _entry.Path,
			State: _state,
			Running: _state === "Running",
			Args: _entry.Args.map((_a) => ({ Name: _a.Name, Required: _a.Required, Value: _a.Value })),
			Schedule: {
				Enabled: _entry.Schedule.Enabled,
				Kind: _entry.Schedule.Kind,
				AfterSeconds: _entry.Schedule.OffsetSec,
				AtTime: _entry.Schedule.AtTime,
				Repeat: _entry.Schedule.Repeat,
				Text: ScheduleCalc.Describe(_entry.Schedule),
			},
			KeepAfterBoot: _entry.KeepAfterBoot,
			Presets: _entry.Presets.map((_p) => ({ Name: _p.Name, Values: { ..._p.Values } })),
			SelectedPreset: _entry.SelectedPreset,
			NextDueAtMs: _entry.NextDueAtMs,
			NextDueText: ScriptFormat.Clock(_entry.NextDueAtMs, _nowMs),
			RemainingMs: remain,
			RemainText: ScriptFormat.RemainText(_entry, _state, _nowMs),
			MissedAtMs: _entry.MissedAtMs,
			RunCount: _entry.RunCount,
			LastRun: ScriptFormat.RunSummary(_entry.LastRun),
		};
	}
}
