/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 등록 속성. XML 문자열 파싱·기본값·상속·바인딩 알림의 단일 창구다.
*/

import type { UIElement } from "./UIElement";

export interface IUIPropertyMeta
{
	Default: unknown;
	Parse?: (_text: string) => unknown;
	Inherits?: boolean;
	AffectsBinding?: boolean;
	Coerce?: (_element: UIElement, _value: unknown) => unknown;
}

export type OwnerCtor = object;

export class UIProperty<T>
{
	// ==================== 정적 ====================
	private static readonly s_registry_ = new Map<OwnerCtor, Map<string, UIProperty<never>>>();

	// ==================== 멤버 ====================
	public readonly Name: string;
	public readonly Owner: OwnerCtor;
	public readonly Meta: IUIPropertyMeta;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Register로만 만든다. 직접 new 금지.
	// @param _name: 속성 이름
	// @param _owner: 소유 생성자
	// @param _meta: 메타
	private constructor(_name: string, _owner: OwnerCtor, _meta: IUIPropertyMeta)
	{
		this.Name = _name;
		this.Owner = _owner;
		this.Meta = _meta;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 속성을 등록한다. 같은 owner에 같은 이름이 있으면 throw.
	// @param _name: 속성 이름
	// @param _owner: 소유 생성자
	// @param _meta: 메타
	public static Register<T>(_name: string, _owner: OwnerCtor, _meta: IUIPropertyMeta): UIProperty<T>
	{
		let map = UIProperty.s_registry_.get(_owner);
		if (map === undefined)
		{
			map = new Map();
			UIProperty.s_registry_.set(_owner, map);
		}
		if (map.has(_name))
			throw new Error(`[UIProperty] 중복 등록: ${UIProperty.OwnerName(_owner)}.${_name}`);
		const prop = new UIProperty<T>(_name, _owner, _meta);
		map.set(_name, prop as UIProperty<never>);
		return prop;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// owner의 프로토타입 체인을 거슬러 이름으로 속성을 찾는다.
	// @param _owner: 소유 생성자
	// @param _name: 속성 이름
	public static Lookup(_owner: OwnerCtor, _name: string): UIProperty<unknown> | null
	{
		let ctor: OwnerCtor | null = _owner;
		while (ctor !== null && ctor !== Function.prototype)
		{
			const found = UIProperty.s_registry_.get(ctor)?.get(_name);
			if (found !== undefined)
				return found;
			ctor = Object.getPrototypeOf(ctor) as OwnerCtor | null;
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// owner에 등록된 전 속성을 반환한다. Test API 직렬화에 사용.
	// @param _owner: 소유 생성자
	public static AllOf(_owner: OwnerCtor): UIProperty<unknown>[]
	{
		const out: UIProperty<unknown>[] = [];
		let ctor: OwnerCtor | null = _owner;
		while (ctor !== null && ctor !== Function.prototype)
		{
			for (const prop of UIProperty.s_registry_.get(ctor)?.values() ?? [])
				out.push(prop);
			ctor = Object.getPrototypeOf(ctor) as OwnerCtor | null;
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트를 값으로 바꾼다. Parse 없으면 number/boolean/string 추론.
	// @param _text: 원문
	public Parse(_text: string): T
	{
		if (this.Meta.Parse !== undefined)
			return this.Meta.Parse(_text) as T;
		const trimmed = _text.trim();
		if (trimmed === "true")
			return true as T;
		if (trimmed === "false")
			return false as T;
		const num = Number(trimmed);
		if (trimmed.length > 0 && !Number.isNaN(num))
			return num as T;
		return _text as T;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기본값을 구한다. 함수형이면 호출.
	public GetDefault(): T
	{
		const def = this.Meta.Default;
		if (typeof def === "function")
			return (def as () => unknown)() as T;
		return def as T;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 소유자 표시 이름. 에러 메시지용.
	// @param _owner: 소유 생성자
	private static OwnerName(_owner: OwnerCtor): string
	{
		const name = (_owner as { name?: unknown }).name;
		return typeof name === "string" ? name : "?";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 길이 파싱. "Auto" 또는 숫자. Width/Height 공용.
	// @param _text: 원문
	public static ParseLength(_text: string): number | "Auto"
	{
		if (_text.trim() === "Auto")
			return "Auto";
		const num = Number(_text.trim());
		if (Number.isNaN(num))
			throw new Error(`[UIProperty] 길이 파싱 실패: ${_text}`);
		return num;
	}
}
