/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RegisterWindow TC39 데코레이터. WindowRegistry에 이름을 꽂는다.
*/

import { WindowRegistry } from "./WindowRegistry";
import type { WindowCtor } from "./WindowRegistry";

export function RegisterWindow(_name: string): (_target: WindowCtor, _context: ClassDecoratorContext) => void
{
	return (_target: WindowCtor, _context: ClassDecoratorContext): void =>
	{
		WindowRegistry.Register(_name, _target);
	};
}
