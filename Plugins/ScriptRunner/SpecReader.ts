/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: SpecReader. MCP Tool 입력(검증되지 않은 JSON)을 등록 정보·수정 정보로 굳힌다.
	      외부 입력이 엔진을 깨뜨리지 않도록 모양이 틀리면 무엇이 왜 틀렸는지 문구로 돌려준다.
	      예약은 평평한 필드(Schedule·AfterSeconds·AtTime·AtDate·Repeat)로 받는다. AI가 쓰기 쉽다.
*/

import { ScheduleCalc } from "./ScheduleCalc";
import { CloneSchedule, EmptySchedule } from "./ScriptStore";
import type { IEntryPatch, IScriptArg, IScriptEntry, IScriptSchedule, TArgValues, TPatchOutcome, TSpecOutcome } from "./Types";

type TArgsOutcome =
	| { Ok: true; Args: IScriptArg[] }
	| { Ok: false; Error: string };

type TScheduleOutcome =
	| { Ok: true; Schedule: IScriptSchedule }
	| { Ok: false; Error: string };

export type TValuesRead =
	| { Ok: true; Values: TArgValues | undefined }
	| { Ok: false; Error: string };

const kScheduleKeys: ReadonlyArray<string> = ["Schedule", "AfterSeconds", "AtTime", "AtDate", "Repeat"];

//////////////////////////////////////////////////////////////////////////////////////
// 값을 문자열로 굳힌다. 숫자·불리언은 글자로 바꾸고 나머지는 null.
// @param _value: 값
function AsText(_value: unknown): string | null
{
	if (typeof _value === "string")
		return _value;
	if (typeof _value === "number" && Number.isFinite(_value))
		return String(_value);
	if (typeof _value === "boolean")
		return _value ? "true" : "false";
	return null;
}

export class SpecReader
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 입력을 읽는다. Path는 필수다.
	// @param _args: Tool 인자
	public static ReadSpec(_args: Record<string, unknown>): TSpecOutcome
	{
		const path = typeof _args["Path"] === "string" ? _args["Path"].trim() : "";
		if (path.length === 0)
			return { Ok: false, Error: "Path가 비어 있습니다. 실행할 스크립트 파일의 절대 경로를 주세요." };
		const args = SpecReader.ReadArgs(_args["Args"]);
		if (!args.Ok)
			return args;
		const schedule = SpecReader.ReadSchedule(_args, EmptySchedule());
		if (!schedule.Ok)
			return schedule;
		const keep = _args["KeepAfterBoot"];
		if (keep !== undefined && typeof keep !== "boolean")
			return { Ok: false, Error: "KeepAfterBoot는 true/false여야 합니다." };
		return {
			Ok: true,
			Spec: {
				Title: typeof _args["Title"] === "string" ? _args["Title"] : "",
				Path: path,
				Args: args.Args,
				Schedule: schedule.Schedule,
				KeepAfterBoot: keep === true,
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 수정 입력을 읽는다. 준 필드만 패치에 담는다. 예약 필드는 하나라도 있으면 현재 예약에 겹쳐 새로 만든다.
	// @param _args: Tool 인자
	// @param _entry: 현재 항목
	public static ReadPatch(_args: Record<string, unknown>, _entry: IScriptEntry): TPatchOutcome
	{
		const patch: IEntryPatch = {};
		if (_args["Title"] !== undefined)
		{
			if (typeof _args["Title"] !== "string")
				return { Ok: false, Error: "Title은 문자열이어야 합니다." };
			patch.Title = _args["Title"];
		}
		if (_args["Path"] !== undefined)
		{
			if (typeof _args["Path"] !== "string" || _args["Path"].trim().length === 0)
				return { Ok: false, Error: "Path는 비어 있지 않은 문자열이어야 합니다." };
			patch.Path = _args["Path"];
		}
		if (_args["Args"] !== undefined)
		{
			const args = SpecReader.ReadArgs(_args["Args"]);
			if (!args.Ok)
				return args;
			patch.Args = args.Args;
		}
		if (kScheduleKeys.some((_key) => _args[_key] !== undefined))
		{
			const schedule = SpecReader.ReadSchedule(_args, _entry.Schedule);
			if (!schedule.Ok)
				return schedule;
			patch.Schedule = schedule.Schedule;
		}
		if (_args["KeepAfterBoot"] !== undefined)
		{
			if (typeof _args["KeepAfterBoot"] !== "boolean")
				return { Ok: false, Error: "KeepAfterBoot는 true/false여야 합니다." };
			patch.KeepAfterBoot = _args["KeepAfterBoot"];
		}
		const values = SpecReader.ReadValues(_args["ArgValues"]);
		if (!values.Ok)
			return values;
		if (values.Values !== undefined)
			patch.ArgValues = values.Values;
		return { Ok: true, Patch: patch };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인자 값 입력을 읽는다. 이름별 객체 또는 순서대로 배열. 없으면 Values가 undefined다.
	// @param _raw: ArgValues 값
	public static ReadValues(_raw: unknown): TValuesRead
	{
		if (_raw === undefined || _raw === null)
			return { Ok: true, Values: undefined };
		if (Array.isArray(_raw))
		{
			const list: string[] = [];
			for (const item of _raw)
			{
				const text = AsText(item);
				if (text === null)
					return { Ok: false, Error: "ArgValues 배열에는 문자열·숫자만 넣을 수 있습니다." };
				list.push(text);
			}
			return { Ok: true, Values: list };
		}
		if (typeof _raw !== "object")
			return { Ok: false, Error: "ArgValues는 {\"인자 이름\": \"값\"} 객체 또는 [\"값1\", \"값2\"] 배열이어야 합니다." };
		const map: Record<string, string> = {};
		for (const [key, value] of Object.entries(_raw as Record<string, unknown>))
		{
			const text = AsText(value);
			if (text === null)
				return { Ok: false, Error: `ArgValues.${key} 값은 문자열·숫자여야 합니다.` };
			map[key] = text;
		}
		return { Ok: true, Values: map };
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 인자 정의 배열을 읽는다. 항목은 {Name, Required?, Value?} 또는 이름 문자열. 기본 Required=true.
	// @param _raw: Args 값
	private static ReadArgs(_raw: unknown): TArgsOutcome
	{
		if (_raw === undefined || _raw === null)
			return { Ok: true, Args: [] };
		if (!Array.isArray(_raw))
			return { Ok: false, Error: "Args는 배열이어야 합니다. 예: [{\"Name\":\"Branch\",\"Required\":true}]" };
		const args: IScriptArg[] = [];
		for (let idx = 0; idx < _raw.length; ++idx)
		{
			const item: unknown = _raw[idx];
			if (typeof item === "string")
			{
				args.push({ Name: item, Required: true, Value: "" });
				continue;
			}
			if (typeof item !== "object" || item === null)
				return { Ok: false, Error: `Args[${idx}]는 객체 또는 이름 문자열이어야 합니다.` };
			const record = item as Record<string, unknown>;
			const name = typeof record["Name"] === "string" ? record["Name"] : "";
			const value = AsText(record["Value"]) ?? "";
			args.push({ Name: name, Required: record["Required"] !== false, Value: value });
		}
		return { Ok: true, Args: args };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 평평한 예약 필드를 읽어 바탕 예약에 겹친다.
	// Schedule: "None"(예약 없음) / "After"(AfterSeconds 뒤) / "At"(AtTime, AtDate 선택).
	// @param _args: Tool 인자
	// @param _base: 바탕 예약(등록이면 빈 예약, 수정이면 현재 예약)
	private static ReadSchedule(_args: Record<string, unknown>, _base: IScriptSchedule): TScheduleOutcome
	{
		const schedule = CloneSchedule(_base);
		const kind = _args["Schedule"];
		if (kind !== undefined)
		{
			const text = typeof kind === "string" ? kind.trim().toLowerCase() : "";
			if (text === "none" || text === "")
				schedule.Enabled = false;
			else if (text === "after")
			{
				schedule.Enabled = true;
				schedule.Kind = "After";
			}
			else if (text === "at")
			{
				schedule.Enabled = true;
				schedule.Kind = "At";
			}
			else
				return { Ok: false, Error: `Schedule은 "None", "After", "At" 중 하나여야 합니다: ${JSON.stringify(kind)}` };
		}
		const seconds = _args["AfterSeconds"];
		if (seconds !== undefined)
		{
			if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 1)
				return { Ok: false, Error: "AfterSeconds는 1 이상의 숫자(초)여야 합니다." };
			schedule.OffsetSec = Math.round(seconds);
			if (kind === undefined)
			{
				schedule.Enabled = true;
				schedule.Kind = "After";
			}
		}
		const at = SpecReader.ReadAtTime(_args);
		if (at !== null)
		{
			if (at.startsWith("!"))
				return { Ok: false, Error: at.slice(1) };
			schedule.AtTime = at;
			if (kind === undefined && seconds === undefined)
			{
				schedule.Enabled = true;
				schedule.Kind = "At";
			}
		}
		if (_args["Repeat"] !== undefined)
		{
			if (typeof _args["Repeat"] !== "boolean")
				return { Ok: false, Error: "Repeat는 true/false여야 합니다." };
			schedule.Repeat = _args["Repeat"];
		}
		if (!schedule.Enabled)
		{
			if (schedule.Repeat && _args["Repeat"] === true)
				return { Ok: false, Error: "반복 수행(Repeat)은 스케줄링(Schedule \"After\" 또는 \"At\")과 함께만 쓸 수 있습니다." };
			schedule.Repeat = false;
			return { Ok: true, Schedule: schedule };
		}
		if (schedule.Kind === "After" && schedule.OffsetSec < 1)
			return { Ok: false, Error: "Schedule \"After\"에는 AfterSeconds(1 이상)가 필요합니다." };
		if (schedule.Kind === "At" && ScheduleCalc.ParseAtTime(schedule.AtTime) === null)
			return { Ok: false, Error: "Schedule \"At\"에는 AtTime(\"HH:mm\" 또는 \"YYYY-MM-DD HH:mm\")이 필요합니다." };
		return { Ok: true, Schedule: schedule };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// AtTime·AtDate를 합쳐 "HH:mm" 또는 "YYYY-MM-DD HH:mm"으로 만든다.
	// 둘 다 없으면 null, 형식 오류면 "!" + 사유를 돌려준다(호출자가 오류로 바꾼다).
	// @param _args: Tool 인자
	private static ReadAtTime(_args: Record<string, unknown>): string | null
	{
		const timeRaw = _args["AtTime"];
		const dateRaw = _args["AtDate"];
		if (timeRaw === undefined && dateRaw === undefined)
			return null;
		const time = typeof timeRaw === "string" ? timeRaw.trim() : "";
		const date = typeof dateRaw === "string" ? dateRaw.trim() : "";
		if (time.length === 0)
			return "!AtTime이 비어 있습니다. \"HH:mm\" 또는 \"YYYY-MM-DD HH:mm\" 형식으로 주세요.";
		if (date.length > 0 && !ScheduleCalc.IsValidDate(date))
			return `!AtDate "${date}"는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.`;
		const full = date.length > 0 ? `${date} ${time}` : time;
		if (ScheduleCalc.ParseAtTime(full) === null)
			return `!AtTime "${full}"은 형식이 잘못됐습니다. \"HH:mm\" 또는 \"YYYY-MM-DD HH:mm\"(24시간)이어야 합니다.`;
		return full;
	}
}
