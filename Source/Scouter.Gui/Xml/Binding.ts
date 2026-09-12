/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Binding 1건. 평가·의존·해제를 들고 있다.
*/

import { UIElement } from "../Core/UIElement";
import type { UIProperty } from "../Core/UIProperty";
import { UIValues } from "./UIValue";
import { BindingResolver } from "./BindingResolver";
import type { IBindingScope } from "./BindingResolver";
import type { IParsedBinding } from "./Expression/Ast";
import { BindingMode } from "./Expression/Ast";

export class Binding
{
	// ==================== 멤버 ====================
	public readonly Target: UIElement;
	public readonly Property: UIProperty<unknown>;
	public readonly Parsed: IParsedBinding;
	public readonly Deps = new Set<string>();
	private readonly scope_: () => IBindingScope;
	private disposed_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 바인딩 1건을 만든다.
	// @param _target: 대상 요소
	// @param _prop: 대상 속성
	// @param _parsed: 파싱 결과
	// @param _scope: 범위 공장
	public constructor(_target: UIElement, _prop: UIProperty<unknown>, _parsed: IParsedBinding, _scope: () => IBindingScope)
	{
		this.Target = _target;
		this.Property = _prop;
		this.Parsed = _parsed;
		this.scope_ = _scope;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 의존에서 빠진다. 그래프가 별도로 제거한다.
	public Dispose(): void
	{
		this.disposed_ = true;
		this.Deps.clear();
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 평가하고 대상에 쓴다. 읽은 참조를 Deps에 다시 기록.
	public Evaluate(): void
	{
		if (this.disposed_)
			return;
		const traced = new Set<string>();
		const scope = this.scope_();
		const tracing: IBindingScope = {
			DataGet: (_key) => scope.DataGet(_key),
			ElementProp: (_name, _prop) => scope.ElementProp(_name, _prop),
			RelativeProp: (_source, _path) => scope.RelativeProp(_source, _path),
			SettingsGet: (_path) => scope.SettingsGet(_path),
			ThemeToken: (_token) => scope.ThemeToken(_token),
			EnvGet: (_key) => scope.EnvGet(_key),
			Trace: (_dep) => { traced.add(_dep); scope.Trace(_dep); },
		};
		let display = "";
		if (this.Parsed.Mode === BindingMode.Expression)
		{
			const node = this.Parsed.Parts[0];
			if (typeof node !== "string" && node !== undefined)
				display = UIValues.ToDisplay(BindingResolver.Evaluate(node, tracing));
		}
		else
		{
			const parts: string[] = [];
			for (const part of this.Parsed.Parts)
			{
				if (typeof part === "string")
					parts.push(part);
				else
					parts.push(UIValues.ToDisplay(BindingResolver.Evaluate(part, tracing)));
			}
			display = parts.join("");
		}
		this.Deps.clear();
		for (const dep of traced)
			this.Deps.add(dep);
		this.Target.SetValue(this.Property, this.Property.Parse(display));
	}
}
