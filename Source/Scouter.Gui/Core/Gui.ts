/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Gui 진입점. 요소 팩토리 맵과 버전, 테스트 루트 생성을 둔다.
*/

import { UIElement } from "./UIElement";

type ElementCtor = new () => UIElement;

export class Gui
{
	// ==================== 정적 ====================
	private static readonly s_factory_ = new Map<string, ElementCtor>();
	private static readonly s_pending_: Array<() => void> = [];
	private static s_registered_ = false;

	// ==================== 속성 ====================
	public static get Version(): string { return "0.4.0"; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 태그를 생성자에 묶는다. RegisterElement 데코레이터가 호출.
	// @param _tag: XML 태그
	// @param _ctor: 생성자
	public static RegisterElement(_tag: string, _ctor: ElementCtor): void
	{
		Gui.s_factory_.set(_tag, _ctor);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 태그로 요소를 만든다. 없으면 null.
	// @param _tag: XML 태그
	public static CreateElement(_tag: string): UIElement | null
	{
		const ctor = Gui.s_factory_.get(_tag);
		if (ctor === undefined)
			return null;
		return new ctor();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 콜백을 쌓는다. Panels·Controls 모듈이 import 시점에 호출.
	// @param _fn: 등록 함수
	public static OnRegister(_fn: () => void): void
	{
		if (Gui.s_registered_)
			_fn();
		else
			Gui.s_pending_.push(_fn);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록된 전 태그를 반환한다. 스키마 생성용.
	public static Names(): string[]
	{
		return [...Gui.s_factory_.keys()];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 내장 요소를 팩토리에 반영한다. P1은 Core만, 패널·컨트롤은 05/09에서 추가.
	public static RegisterBuiltInElements(): void
	{
		if (Gui.s_registered_)
			return;
		Gui.s_registered_ = true;
		for (const fn of Gui.s_pending_)
			fn();
		Gui.s_pending_.length = 0;
	}
}
