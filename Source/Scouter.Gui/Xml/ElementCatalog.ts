/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 태그 → 생성자 카탈로그. Gui 팩토리와 같은 맵을 쓴다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { Gui } from "../Core/Gui";

export class ElementCatalog
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 태그를 생성자에 묶는다. 네임스페이스는 무시하고 이름만 본다.
	// @param _tag: 태그
	// @param _ctor: 생성자
	public static Register(_tag: string, _ctor: new () => UIElement): void
	{
		Gui.RegisterElement(_tag, _ctor);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 태그로 요소를 만든다. 없으면 null.
	// @param _tag: 태그 (prefix:Name 허용)
	public static Create(_tag: string): UIElement | null
	{
		const plain = _tag.includes(":") ? (_tag.split(":")[1] as string) : _tag;
		return Gui.CreateElement(plain);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 태그 등록 여부를 본다.
	// @param _tag: 태그
	public static Has(_tag: string): boolean
	{
		return ElementCatalog.Create(_tag) !== null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록된 전 태그를 반환한다.
	public static Names(): string[]
	{
		return Gui.Names();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 태그의 등록 속성 목록을 반환한다. ControlCatalog Tool용.
	// @param _tag: 태그
	public static PropertiesOf(_tag: string): UIProperty<unknown>[]
	{
		const el = ElementCatalog.Create(_tag);
		if (el === null)
			return [];
		const props = UIProperty.AllOf(el.constructor);
		el.Dispose();
		return props;
	}
}
