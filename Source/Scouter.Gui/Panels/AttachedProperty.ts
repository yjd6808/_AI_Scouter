/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 붙임 속성. Grid.Row처럼 자식에 값을 보관하고 부모 Panel에 알린다.
*/

import type { UIElement } from "../Core/UIElement";

export interface IAttachedMeta<T>
{
	Default: T;
	Parse: (_text: string) => T;
}

export class AttachedProperty<T>
{
	// ==================== 정적 ====================
	private static readonly s_registry_ = new Map<string, AttachedProperty<unknown>>();

	// ==================== 멤버 ====================
	public readonly Name: string;
	public readonly Meta: IAttachedMeta<T>;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 직접 new 금지. Register로만 만든다.
	// @param _name: 이름 (예 "Grid.Row")
	// @param _meta: 메타
	private constructor(_name: string, _meta: IAttachedMeta<T>)
	{
		this.Name = _name;
		this.Meta = _meta;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 붙임 속성을 만든다.
	// @param _name: 이름
	// @param _meta: 메타
	public static Register<T>(_name: string, _meta: IAttachedMeta<T>): AttachedProperty<T>
	{
		const prop = new AttachedProperty<T>(_name, _meta);
		AttachedProperty.s_registry_.set(_name, prop);
		return prop;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름으로 붙임 속성을 찾는다. "Dock" → "DockPanel.Dock"도 시도.
	// @param _name: 이름
	public static Lookup(_name: string): AttachedProperty<unknown> | null
	{
		const direct = AttachedProperty.s_registry_.get(_name);
		if (direct !== undefined)
			return direct;
		for (const [key, prop] of AttachedProperty.s_registry_)
		{
			if (key.endsWith(`.${_name}`))
				return prop;
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다. 미설정이면 기본값.
	// @param _element: 요소
	public Get(_element: UIElement): T
	{
		const found = _element.GetAttached(this) as T | undefined;
		return found ?? this.Meta.Default;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓰고 부모 Panel에 알린다.
	// @param _element: 요소
	// @param _value: 값
	public Set(_element: UIElement, _value: T): void
	{
		_element.SetAttached(this, _value);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 문자열을 파싱해 쓴다. XML 로더용.
	// @param _element: 요소
	// @param _text: 원문
	public ParseAndSet(_element: UIElement, _text: string): void
	{
		this.Set(_element, this.Meta.Parse(_text));
	}
}
