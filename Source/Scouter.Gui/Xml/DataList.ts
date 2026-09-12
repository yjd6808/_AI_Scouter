/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: DataList. XML 루트의 공유 메모장. 타입 강제·스냅샷·Changed 1회를 보장한다.
*/

import { SimpleEvent } from "../Core/SimpleEvent";
import { UIValues } from "./UIValue";
import type { UIValue } from "./UIValue";

export enum DataType
{
	Bool = "Bool",
	Int = "Int",
	Float = "Float",
	String = "String",
	Array = "Array",
	Map = "Map",
}

const kAliasEntries: Array<[string, DataType]> = [
	["Bool", DataType.Bool], ["bool", DataType.Bool],
	["Int", DataType.Int], ["int", DataType.Int],
	["_s8", DataType.Int], ["_u8", DataType.Int], ["_s16", DataType.Int], ["_u16", DataType.Int],
	["_s32", DataType.Int], ["_u32", DataType.Int], ["_s32l", DataType.Int], ["_u32l", DataType.Int],
	["_s64", DataType.Int], ["_u64", DataType.Int],
	["Float", DataType.Float], ["float", DataType.Float], ["double", DataType.Float],
	["_f32", DataType.Float], ["_f64", DataType.Float], ["_f64l", DataType.Float],
	["String", DataType.String], ["string", DataType.String], ["_string", DataType.String],
	["CharPtr", DataType.String], ["_char", DataType.String], ["_achar", DataType.String], ["_wchar", DataType.String],
	["Array", DataType.Array], ["array", DataType.Array],
	["Map", DataType.Map], ["map", DataType.Map],
];

const kAliases: Record<string, DataType> = Object.fromEntries(kAliasEntries);

interface IDataEntry
{
	Type: DataType;
	Value: UIValue;
}

export class DataList
{
	// ==================== 멤버 ====================
	private readonly entries_ = new Map<string, IDataEntry>();

	// ==================== 이벤트 ====================
	public readonly Changed = new SimpleEvent<string[]>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 정식 타입으로 정규화한다. 목록 밖이면 null.
	// @param _text: Type 속성 원문
	public static NormalizeType(_text: string): DataType | null
	{
		return kAliases[_text] ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키를 선언한다. 중복이면 throw.
	// @param _key: 키
	// @param _type: 정식 타입
	// @param _default: 기본값 원문
	public Declare(_key: string, _type: DataType, _default: string): void
	{
		if (this.entries_.has(_key))
			throw new Error(`[DataList] 중복 선언: ${_key}`);
		this.entries_.set(_key, { Type: _type, Value: DataList.Coerce(_type, _default) });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다. JS 값으로 푼다.
	// @param _key: 키
	public Get(_key: string): unknown
	{
		const entry = this.entries_.get(_key);
		if (entry === undefined)
			throw new Error(`[DataList] 미선언 키: ${_key}`);
		return UIValues.ToJs(entry.Value);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓴다. 타입 강제 후 Changed를 쏜다.
	// @param _key: 키
	// @param _value: JS 값
	public Set(_key: string, _value: unknown): void
	{
		const entry = this.entries_.get(_key);
		if (entry === undefined)
			throw new Error(`[DataList] 미선언 키: ${_key}`);
		entry.Value = DataList.Coerce(entry.Type, _value);
		this.Changed.Invoke([_key]);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 여러 키를 바꾸고 Changed를 1회만 쏜다.
	// @param _patch: 키→값
	public Update(_patch: Record<string, unknown>): void
	{
		const keys: string[] = [];
		for (const [key, value] of Object.entries(_patch))
		{
			const entry = this.entries_.get(key);
			if (entry === undefined)
				throw new Error(`[DataList] 미선언 키: ${key}`);
			entry.Value = DataList.Coerce(entry.Type, value);
			keys.push(key);
		}
		if (keys.length > 0)
			this.Changed.Invoke(keys);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선언 여부를 본다.
	// @param _key: 키
	public Has(_key: string): boolean
	{
		return this.entries_.has(_key);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 키를 반환한다.
	public Keys(): string[]
	{
		return [...this.entries_.keys()];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키의 타입을 본다. 미선언이면 null.
	// @param _key: 키
	public TypeOf(_key: string): DataType | null
	{
		return this.entries_.get(_key)?.Type ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 선언을 지운다. 핫리로드 재선언용.
	public Reset(): void
	{
		this.entries_.clear();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 값을 복사한다. 핫리로드 보존용.
	public Snapshot(): Record<string, unknown>
	{
		const out: Record<string, unknown> = {};
		for (const [key, entry] of this.entries_)
			out[key] = UIValues.ToJs(entry.Value);
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스냅샷을 되돌린다. 선언된 키만, Changed 1회.
	// @param _snapshot: 스냅샷
	public Restore(_snapshot: Record<string, unknown>): void
	{
		const keys: string[] = [];
		for (const [key, value] of Object.entries(_snapshot))
		{
			const entry = this.entries_.get(key);
			if (entry === undefined)
				continue;
			entry.Value = DataList.Coerce(entry.Type, value);
			keys.push(key);
		}
		if (keys.length > 0)
			this.Changed.Invoke(keys);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 타입에 맞춘다. 실패하면 throw(호출자가 Warn 후 기존값 유지).
	// @param _type: 정식 타입
	// @param _value: 원문 또는 JS 값
	private static Coerce(_type: DataType, _value: unknown): UIValue
	{
		const text = typeof _value === "string" ? _value : null;
		switch (_type)
		{
			case DataType.Bool:
				if (typeof _value === "boolean")
					return UIValues.From(_value);
				if (text === "true")
					return UIValues.From(true);
				if (text === "false")
					return UIValues.From(false);
				return UIValues.From(Boolean(_value));
			case DataType.Int:
			{
				const num = typeof _value === "number" ? Math.trunc(_value) : Number(text ?? NaN);
				if (Number.isNaN(num))
					throw new Error(`[DataList] Int 변환 불가: ${String(_value)}`);
				return UIValues.From(Number.isInteger(num) ? num : Math.trunc(num));
			}
			case DataType.Float:
			{
				const num = typeof _value === "number" ? _value : Number(text ?? NaN);
				if (Number.isNaN(num))
					throw new Error(`[DataList] Float 변환 불가: ${String(_value)}`);
				return UIValues.From(num);
			}
			case DataType.String:
				return UIValues.From(text ?? String(_value));
			case DataType.Array:
				if (Array.isArray(_value))
					return UIValues.From(_value);
				if (text !== null)
				{
					try
					{
						return UIValues.From(JSON.parse(text) as unknown);
					}
					catch
					{
						throw new Error(`[DataList] Array 변환 불가: ${text}`);
					}
				}
				return UIValues.From([_value]);
			case DataType.Map:
				if (typeof _value === "object" && _value !== null)
					return UIValues.From(_value);
				if (text !== null)
				{
					try
					{
						return UIValues.From(JSON.parse(text) as unknown);
					}
					catch
					{
						throw new Error(`[DataList] Map 변환 불가: ${text}`);
					}
				}
				throw new Error(`[DataList] Map 변환 불가: ${String(_value)}`);
			default:
				throw new Error(`[DataList] 알 수 없는 타입: ${String(_type)}`);
		}
	}
}
