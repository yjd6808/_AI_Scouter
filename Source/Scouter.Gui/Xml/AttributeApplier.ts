/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 속성 분기. 리터럴·바인딩·붙임·이벤트·커맨드를 갈라 적용한다.
*/

import { UIElement } from "../Core/UIElement";
import { UIProperty } from "../Core/UIProperty";
import { RoutedEvent } from "../Core/RoutedEvent";
import type { RoutedEventArgs } from "../Core/RoutedEvent";
import { AttachedProperty } from "../Panels/AttachedProperty";
import { ExpressionParser } from "./Expression/Parser";
import type { LoadContext } from "./LoadContext";

const kAlwaysInterpolate = new Set(["Text", "Content", "Header", "Title", "ToolTip", "Placeholder"]);

const kCommandKey = { Command: true };
const kCommandParamKey = { CommandParameter: true };

export class AttributeApplier
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 속성 1개를 적용한다. 바인딩이면 Pending에 적재.
	// @param _el: 요소
	// @param _name: 속성 이름
	// @param _raw: 원문
	// @param _ctx: 로드 문맥
	public static Apply(_el: UIElement, _name: string, _raw: string, _ctx: LoadContext): void
	{
		if (_name === "Command" || _name === "CommandParameter")
		{
			AttributeApplier.ApplyCommand(_el, _name, _raw, _ctx);
			return;
		}
		const events = _el as unknown as Record<string, unknown>;
		if (events[_name] instanceof RoutedEvent)
		{
			AttributeApplier.ApplyEvent(_el, _name, _raw, _ctx);
			return;
		}
		if (_name.includes(".") || _name.includes("-"))
		{
			AttributeApplier.ApplyAttached(_el, _name, _raw, _ctx);
			return;
		}
		const prop = UIProperty.Lookup(_el.constructor, _name);
		if (prop === null)
			throw new Error(`E011 미등록 속성: ${_name}`);
		const parser = new ExpressionParser();
		const parsed = parser.ParseValue(_raw, kAlwaysInterpolate.has(_name));
		if (parsed === null)
		{
			_el.SetValue(prop, prop.Parse(_raw));
			return;
		}
		_ctx.Pending.push({ Target: _el, Property: prop, Parsed: parsed, Raw: _raw });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장된 Command를 읽는다. Button 실행용(P3 이후).
	// @param _el: 요소
	public static CommandOf(_el: UIElement): string
	{
		return (_el.GetAttached(kCommandKey) as string | undefined) ?? "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장된 CommandParameter를 읽는다.
	// @param _el: 요소
	public static CommandParameterOf(_el: UIElement): string
	{
		return (_el.GetAttached(kCommandParamKey) as string | undefined) ?? "";
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 붙임 속성을 파싱해 쓴다.
	// @param _el: 요소
	// @param _name: 이름
	// @param _raw: 원문
	// @param _ctx: 문맥
	private static ApplyAttached(_el: UIElement, _name: string, _raw: string, _ctx: LoadContext): void
	{
		const attached = AttachedProperty.Lookup(_name) ?? AttachedProperty.Lookup(_name.replace(/-/g, "."));
		if (attached === null)
			throw new Error(`E012 미등록 붙임 속성: ${_name}`);
		attached.ParseAndSet(_el, _raw);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이벤트 속성을 코드비하인드 핸들러에 연결한다.
	// @param _el: 요소
	// @param _name: 이벤트 이름
	// @param _handler: 핸들러 이름
	// @param _ctx: 문맥
	private static ApplyEvent(_el: UIElement, _name: string, _handler: string, _ctx: LoadContext): void
	{
		const fn = (_ctx.Handlers as Record<string, unknown>)[_handler];
		if (typeof fn !== "function")
		{
			_ctx.Warnings.push({ Code: "W050", Line: 0, Column: 0, Text: `핸들러 없음: ${_handler}` });
			return;
		}
		const evt = (_el as unknown as Record<string, RoutedEvent<RoutedEventArgs>>)[_name] as RoutedEvent<RoutedEventArgs>;
		evt.Add(fn as (_sender: UIElement, _args: RoutedEventArgs) => void);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 커맨드를 보관한다. 실행은 CommandRegistry(P3).
	// @param _el: 요소
	// @param _name: Command/CommandParameter
	// @param _raw: 원문
	// @param _ctx: 문맥
	private static ApplyCommand(_el: UIElement, _name: string, _raw: string, _ctx: LoadContext): void
	{
		if (_name === "Command")
		{
			if (_ctx.Commands !== null && !_ctx.Commands.Has(_raw))
				_ctx.Warnings.push({ Code: "W051", Line: 0, Column: 0, Text: `Command 미등록: ${_raw}` });
			_el.SetAttached(kCommandKey, _raw);
			const prop = UIProperty.Lookup(_el.constructor, "Command");
			if (prop !== null)
				_el.SetValue(prop, prop.Parse(_raw));
		}
		else
		{
			_el.SetAttached(kCommandParamKey, _raw);
			const prop = UIProperty.Lookup(_el.constructor, "CommandParameter");
			if (prop !== null)
				_el.SetValue(prop, prop.Parse(_raw));
		}
	}
}
