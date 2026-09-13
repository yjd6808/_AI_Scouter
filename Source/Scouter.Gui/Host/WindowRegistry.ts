/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 창 이름 → 클래스 등록소. RegisterWindow 데코레이터가 채운다.
*/

import type { UIElement } from "../Core/UIElement";

export type WindowCtor = new () => UIElement;

export class WindowRegistry
{
	// ==================== 정적 ====================
	private static readonly s_map_ = new Map<string, WindowCtor>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름을 등록한다. 중복이면 throw.
	// @param _name: 창 이름 ("Shell", "P4Util/Main")
	// @param _ctor: 생성자
	public static Register(_name: string, _ctor: WindowCtor): void
	{
		if (WindowRegistry.s_map_.has(_name))
			throw new Error(`[WindowRegistry] 중복 등록: ${_name}`);
		WindowRegistry.s_map_.set(_name, _ctor);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름으로 생성자를 찾는다. 없으면 null.
	// @param _name: 창 이름
	public static Resolve(_name: string): WindowCtor | null
	{
		return WindowRegistry.s_map_.get(_name) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록을 푼다. Plugin 언로드·핫리로드용. 없으면 false.
	// @param _name: 창 이름
	public static Unregister(_name: string): boolean
	{
		return WindowRegistry.s_map_.delete(_name);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록된 전 이름을 반환한다.
	public static Names(): string[]
	{
		return [...WindowRegistry.s_map_.keys()];
	}
}
