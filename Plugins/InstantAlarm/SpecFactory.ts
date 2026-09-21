/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: SpecFactory. 화면 폼과 Tool 인자를 IAlarmSpec 하나로 굳히는 단일 창구.
	      기본값(지속 시간·Topmost)은 설정 getter로 받아 호출 시점에 읽는다. 스냅샷을 뜨지 않는다.
*/

import type { IAlarmOptions, IAlarmSpec, TAlarmUiKind } from "./Types";

const kUiKinds: ReadonlyArray<string> = ["ok", "yesno"];

//////////////////////////////////////////////////////////////////////////////////////
// unknown을 레코드로 좁힌다. 객체가 아니면 null.
// @param _value: 검사 대상
function AsRecord(_value: unknown): Record<string, unknown> | null
{
	if (typeof _value !== "object" || _value === null || Array.isArray(_value))
		return null;
	return _value as Record<string, unknown>;
}

//////////////////////////////////////////////////////////////////////////////////////
// 문자열을 꺼낸다. 아니면 기본값.
// @param _record: 원본 레코드
// @param _key: 키
// @param _def: 기본값
function PickText(_record: Record<string, unknown>, _key: string, _def: string): string
{
	const value = _record[_key];
	return typeof value === "string" ? value : _def;
}

//////////////////////////////////////////////////////////////////////////////////////
// 유한 숫자를 꺼낸다. 아니면 기본값.
// @param _record: 원본 레코드
// @param _key: 키
// @param _def: 기본값
function PickNumber(_record: Record<string, unknown>, _key: string, _def: number): number
{
	const value = _record[_key];
	return typeof value === "number" && Number.isFinite(value) ? value : _def;
}

//////////////////////////////////////////////////////////////////////////////////////
// 불린을 꺼낸다. 아니면 기본값.
// @param _record: 원본 레코드
// @param _key: 키
// @param _def: 기본값
function PickFlag(_record: Record<string, unknown>, _key: string, _def: boolean): boolean
{
	const value = _record[_key];
	return typeof value === "boolean" ? value : _def;
}

export class SpecFactory
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상대(After) 스펙을 만든다. 시각 계산은 엔진이 예약 시점에 한다.
	// @param _id: 스펙 Id
	// @param _seconds: 지금부터 몇 초 뒤
	// @param _title: 제목
	// @param _message: 내용
	// @param _options: 설정 getter 묶음
	public static After(_id: string, _seconds: number, _title: string, _message: string, _options: IAlarmOptions): IAlarmSpec
	{
		const spec = SpecFactory.Blank(_id, _title, _message, _options);
		spec.Kind = "After";
		spec.OffsetSec = Math.round(_seconds);
		return spec;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 절대(At) 스펙을 만든다. 형식 검증은 엔진의 ResolveDueAtMs가 맡는다.
	// @param _id: 스펙 Id
	// @param _atTime: "HH:mm" 또는 "YYYY-MM-DD HH:mm"
	// @param _title: 제목
	// @param _message: 내용
	// @param _roll: 지난 시각이면 다음 날로 넘길지
	// @param _options: 설정 getter 묶음
	public static At(_id: string, _atTime: string, _title: string, _message: string, _roll: boolean, _options: IAlarmOptions): IAlarmSpec
	{
		const spec = SpecFactory.Blank(_id, _title, _message, _options);
		spec.Kind = "At";
		spec.AtTime = _atTime.trim();
		spec.RollToNextDay = _roll;
		return spec;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool 인자 레코드를 스펙으로 굳힌다. 모양이 깨졌거나 제목이 없으면 null.
	// Kind를 생략하면 AtTime 유무로 고른다. 외부 입력이 깨져도 기본값으로 굳힌다.
	// @param _raw: 원본 레코드
	// @param _id: 스펙 Id
	// @param _options: 설정 getter 묶음
	public static FromRecord(_raw: unknown, _id: string, _options: IAlarmOptions): IAlarmSpec | null
	{
		const record = AsRecord(_raw);
		if (record === null)
			return null;
		const title = PickText(record, "Title", "").trim();
		if (title.length === 0)
			return null;
		const message = PickText(record, "Message", "");
		const atTime = PickText(record, "AtTime", "").trim();
		const declared = PickText(record, "Kind", "");
		const isAt = declared === "At" || (declared.length === 0 && atTime.length > 0);
		const spec = isAt
			? SpecFactory.At(_id, atTime, title, message, PickFlag(record, "RollToNextDay", false), _options)
			: SpecFactory.After(_id, PickNumber(record, "Seconds", PickNumber(record, "OffsetSec", 0)), title, message, _options);
		const uiKind = PickText(record, "KindUi", "");
		if (kUiKinds.includes(uiKind))
			spec.KindUi = uiKind as TAlarmUiKind;
		spec.DurationSec = PickNumber(record, "DurationSec", spec.DurationSec);
		spec.Topmost = PickFlag(record, "Topmost", spec.Topmost);
		spec.WithToast = PickFlag(record, "WithToast", spec.WithToast);
		return spec;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 공통 필드를 기본값으로 채운 빈 스펙을 만든다.
	// @param _id: 스펙 Id
	// @param _title: 제목
	// @param _message: 내용
	// @param _options: 설정 getter 묶음
	private static Blank(_id: string, _title: string, _message: string, _options: IAlarmOptions): IAlarmSpec
	{
		return {
			Id: _id,
			Kind: "After",
			Title: _title,
			Message: _message,
			OffsetSec: 0,
			AtTime: "",
			RollToNextDay: false,
			KindUi: "ok",
			DurationSec: Math.max(0, _options.DefaultDurationSec()),
			Topmost: _options.DefaultTopmost(),
			WithToast: false,
		};
	}
}
