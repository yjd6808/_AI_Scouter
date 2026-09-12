/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UIValue 7종. 바인딩 평가기의 값 타입이다.
*/

export enum UIValueKind
{
	Null = "Null",
	Bool = "Bool",
	Int = "Int",
	Float = "Float",
	String = "String",
	Array = "Array",
	Map = "Map",
}

export type UIValue =
	| { Kind: UIValueKind.Null }
	| { Kind: UIValueKind.Bool; Value: boolean }
	| { Kind: UIValueKind.Int; Value: number }
	| { Kind: UIValueKind.Float; Value: number }
	| { Kind: UIValueKind.String; Value: string }
	| { Kind: UIValueKind.Array; Value: UIValue[] }
	| { Kind: UIValueKind.Map; Value: Map<string, UIValue> };

export class UIValues
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 알 수 없는 값을 문자열로 바꾼다. 객체는 JSON, 안 되면 타입명.
	// @param _v: JS 값
	public static StringifyUnknown(_v: unknown): string
	{
		if (typeof _v === "string")
			return _v;
		if (typeof _v === "number" || typeof _v === "boolean" || typeof _v === "bigint")
			return String(_v);
		try
		{
			const json: unknown = JSON.stringify(_v);
			return typeof json === "string" ? json : typeof _v;
		}
		catch
		{
			return typeof _v;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시 텍스트로 바꾼다. unknown 입력용(String 대신).
	// @param _v: JS 값
	public static ToText(_v: unknown): string
	{
		return UIValues.ToDisplay(UIValues.From(_v));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Null 값을 만든다.
	public static Null(): UIValue
	{
		return { Kind: UIValueKind.Null };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// JS 값을 UIValue로 감싼다.
	// @param _v: JS 값
	public static From(_v: unknown): UIValue
	{
		if (_v === null || _v === undefined)
			return UIValues.Null();
		if (typeof _v === "boolean")
			return { Kind: UIValueKind.Bool, Value: _v };
		if (typeof _v === "number")
			return Number.isInteger(_v) ? { Kind: UIValueKind.Int, Value: _v } : { Kind: UIValueKind.Float, Value: _v };
		if (typeof _v === "string")
			return { Kind: UIValueKind.String, Value: _v };
		if (Array.isArray(_v))
			return { Kind: UIValueKind.Array, Value: _v.map((_item) => UIValues.From(_item)) };
		if (_v instanceof Map)
		{
			const map = new Map<string, UIValue>();
			for (const [key, item] of _v)
				map.set(String(key), UIValues.From(item));
			return { Kind: UIValueKind.Map, Value: map };
		}
		if (typeof _v === "object")
		{
			const map = new Map<string, UIValue>();
			for (const [key, item] of Object.entries(_v))
				map.set(key, UIValues.From(item));
			return { Kind: UIValueKind.Map, Value: map };
		}
		return { Kind: UIValueKind.String, Value: UIValues.StringifyUnknown(_v) };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// UIValue를 JS 값으로 푼다.
	// @param _v: UIValue
	public static ToJs(_v: UIValue): unknown
	{
		switch (_v.Kind)
		{
			case UIValueKind.Null: return null;
			case UIValueKind.Bool: return _v.Value;
			case UIValueKind.Int: return _v.Value;
			case UIValueKind.Float: return _v.Value;
			case UIValueKind.String: return _v.Value;
			case UIValueKind.Array: return _v.Value.map((_item) => UIValues.ToJs(_item));
			case UIValueKind.Map:
			{
				const out: Record<string, unknown> = {};
				for (const [key, item] of _v.Value)
					out[key] = UIValues.ToJs(item);
				return out;
			}
			default: return null;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시 문자열로 바꾼다. 대상 UIProperty.Parse에 넘기기 전 단계.
	// @param _v: UIValue
	public static ToDisplay(_v: UIValue): string
	{
		switch (_v.Kind)
		{
			case UIValueKind.Null: return "";
			case UIValueKind.Bool: return _v.Value ? "true" : "false";
			case UIValueKind.Int: return String(_v.Value);
			case UIValueKind.Float: return String(_v.Value);
			case UIValueKind.String: return _v.Value;
			case UIValueKind.Array: return _v.Value.map((_item) => UIValues.ToDisplay(_item)).join(",");
			case UIValueKind.Map: return "[Map]";
			default: return "";
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// truthy 판정. 조건·&&·||·!용.
	// @param _v: UIValue
	public static IsTruthy(_v: UIValue): boolean
	{
		switch (_v.Kind)
		{
			case UIValueKind.Null: return false;
			case UIValueKind.Bool: return _v.Value;
			case UIValueKind.Int: return _v.Value !== 0;
			case UIValueKind.Float: return _v.Value !== 0;
			case UIValueKind.String: return _v.Value.length > 0;
			case UIValueKind.Array: return _v.Value.length > 0;
			case UIValueKind.Map: return _v.Value.size > 0;
			default: return false;
		}
	}
}
