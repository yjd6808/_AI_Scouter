/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RegisterElement TC39 데코레이터. ElementCatalog에 태그를 꽂는다.
*/

import { Gui } from "../Core/Gui";
import type { UIElement } from "../Core/UIElement";

export function RegisterElement(_tag: string): (_target: new () => UIElement, _context: ClassDecoratorContext) => void
{
	return (_target: new () => UIElement, _context: ClassDecoratorContext): void =>
	{
		Gui.RegisterElement(_tag, _target);
	};
}
