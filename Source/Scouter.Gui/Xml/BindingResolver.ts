/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 바인딩 평가기. 순수 함수. 읽은 참조는 scope.Trace에 기록한다.
*/

import { UIValues, UIValueKind } from "./UIValue";
import type { UIValue } from "./UIValue";
import type { AstNode, RefNode } from "./Expression/Ast";

export interface IBindingScope
{
	DataGet(_key: string): UIValue;
	ElementProp(_name: string, _prop: string): UIValue;
	RelativeProp(_source: string, _path: string[]): UIValue;
	SettingsGet(_path: string): UIValue;
	ThemeToken(_token: string): string;
	EnvGet(_key: string): UIValue;
	Trace(_dep: string): void;
}

export class BindingResolver
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// AST를 평가한다.
	// @param _node: 루트
	// @param _scope: 해석 범위
	public static Evaluate(_node: AstNode, _scope: IBindingScope): UIValue
	{
		switch (_node.Kind)
		{
			case "Literal": return BindingResolver.Literal(_node.Text);
			case "Ref": return BindingResolver.EvalRef(_node.Ref, _scope);
			case "Unary": return BindingResolver.EvalUnary(_node.Op, BindingResolver.Evaluate(_node.Operand, _scope));
			case "Binary":
				if (_node.Op === "&&")
				{
					const left = BindingResolver.Evaluate(_node.Left, _scope);
					return UIValues.IsTruthy(left) ? BindingResolver.Evaluate(_node.Right, _scope) : left;
				}
				if (_node.Op === "||")
				{
					const left = BindingResolver.Evaluate(_node.Left, _scope);
					return UIValues.IsTruthy(left) ? left : BindingResolver.Evaluate(_node.Right, _scope);
				}
				return BindingResolver.EvalBinary(_node.Op, BindingResolver.Evaluate(_node.Left, _scope), BindingResolver.Evaluate(_node.Right, _scope), _node.Pos);
			case "Ternary":
			{
				const cond = BindingResolver.Evaluate(_node.Cond, _scope);
				return BindingResolver.Evaluate(UIValues.IsTruthy(cond) ? _node.WhenTrue : _node.WhenFalse, _scope);
			}
			case "Call": return BindingResolver.EvalCall(_node.Name, _node.Args.map((_arg) => BindingResolver.Evaluate(_arg, _scope)), _node.Pos);
			default: return UIValues.Null();
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 리터럴을 값으로 바꾼다. 백틱이면 문자열.
	// @param _text: 원문
	private static Literal(_text: string): UIValue
	{
		if (_text.startsWith("`") && _text.endsWith("`"))
			return { Kind: UIValueKind.String, Value: _text.slice(1, -1) };
		if (_text === "true")
			return { Kind: UIValueKind.Bool, Value: true };
		if (_text === "false")
			return { Kind: UIValueKind.Bool, Value: false };
		if (_text === "null")
			return UIValues.Null();
		const num = Number(_text);
		if (!Number.isNaN(num))
			return Number.isInteger(num) ? { Kind: UIValueKind.Int, Value: num } : { Kind: UIValueKind.Float, Value: num };
		return { Kind: UIValueKind.String, Value: _text };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 참조를 푼다. Trace에 의존 키를 남긴다.
	// @param _ref: 참조
	// @param _scope: 범위
	private static EvalRef(_ref: RefNode, _scope: IBindingScope): UIValue
	{
		switch (_ref.Kind)
		{
			case "DataRef":
				_scope.Trace(`@${_ref.Key}`);
				return _scope.DataGet(_ref.Key);
			case "ElementRef":
				_scope.Trace(`#${_ref.Name}.${_ref.Prop}`);
				return _scope.ElementProp(_ref.Name, _ref.Prop);
			case "SpecialRef":
				if (_ref.Source === "theme")
					return { Kind: UIValueKind.String, Value: _scope.ThemeToken(_ref.Path.join(".")) };
				if (_ref.Source === "settings")
				{
					_scope.Trace(`$settings.${_ref.Path.join(".")}`);
					return _scope.SettingsGet(_ref.Path.join("."));
				}
				if (_ref.Source === "env")
					return _scope.EnvGet(_ref.Path.join("."));
				_scope.Trace(`$${_ref.Source}.${_ref.Path.join(".")}`);
				return _scope.RelativeProp(_ref.Source, _ref.Path);
			default:
				return UIValues.Null();
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 단항 연산.
	// @param _op: 연산자
	// @param _v: 피연산자
	private static EvalUnary(_op: string, _v: UIValue): UIValue
	{
		if (_op === "!")
			return { Kind: UIValueKind.Bool, Value: !UIValues.IsTruthy(_v) };
		const num = BindingResolver.ToNumber(_v);
		if (_v.Kind === UIValueKind.Float)
			return { Kind: UIValueKind.Float, Value: -num };
		return { Kind: UIValueKind.Int, Value: Math.trunc(-num) };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이항 연산. 문자열+숫자는 연결, Int/Int 나눗셈은 Float.
	// @param _op: 연산자
	// @param _l: 좌
	// @param _r: 우
	// @param _pos: 위치
	private static EvalBinary(_op: string, _l: UIValue, _r: UIValue, _pos: number): UIValue
	{
		if (_op === "+")
		{
			if (_l.Kind === UIValueKind.String || _r.Kind === UIValueKind.String)
				return { Kind: UIValueKind.String, Value: UIValues.ToDisplay(_l) + UIValues.ToDisplay(_r) };
			if (_l.Kind === UIValueKind.Float || _r.Kind === UIValueKind.Float)
				return { Kind: UIValueKind.Float, Value: BindingResolver.ToNumber(_l) + BindingResolver.ToNumber(_r) };
			if (BindingResolver.IsNumber(_l) && BindingResolver.IsNumber(_r))
				return { Kind: UIValueKind.Int, Value: BindingResolver.ToNumber(_l) + BindingResolver.ToNumber(_r) };
			return { Kind: UIValueKind.String, Value: UIValues.ToDisplay(_l) + UIValues.ToDisplay(_r) };
		}
		if (_op === "==" || _op === "!=")
		{
			const eq = BindingResolver.IsNumber(_l) && BindingResolver.IsNumber(_r)
				? BindingResolver.ToNumber(_l) === BindingResolver.ToNumber(_r)
				: UIValues.ToDisplay(_l) === UIValues.ToDisplay(_r);
			return { Kind: UIValueKind.Bool, Value: _op === "==" ? eq : !eq };
		}
		if (_op === "<" || _op === "<=" || _op === ">" || _op === ">=")
		{
			const bothNum = BindingResolver.IsNumber(_l) && BindingResolver.IsNumber(_r);
			const left = bothNum ? BindingResolver.ToNumber(_l) : UIValues.ToDisplay(_l);
			const right = bothNum ? BindingResolver.ToNumber(_r) : UIValues.ToDisplay(_r);
			let result = false;
			if (_op === "<")
				result = left < right;
			else if (_op === "<=")
				result = left <= right;
			else if (_op === ">")
				result = left > right;
			else
				result = left >= right;
			return { Kind: UIValueKind.Bool, Value: result };
		}
		const ln = BindingResolver.ToNumber(_l);
		const rn = BindingResolver.ToNumber(_r);
		const isFloat = _l.Kind === UIValueKind.Float || _r.Kind === UIValueKind.Float || _op === "/";
		let out = 0;
		if (_op === "-")
			out = ln - rn;
		else if (_op === "*")
			out = ln * rn;
		else if (_op === "/")
			out = rn === 0 ? NaN : ln / rn;
		else if (_op === "%")
			out = rn === 0 ? NaN : ln % rn;
		else
			throw new Error(`[Resolver] 알 수 없는 연산자: ${_op} @${_pos}`);
		if (Number.isNaN(out))
			return UIValues.Null();
		return isFloat ? { Kind: UIValueKind.Float, Value: out } : { Kind: UIValueKind.Int, Value: Math.trunc(out) };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 내장 함수 10종.
	// @param _name: 이름
	// @param _args: 인자
	// @param _pos: 위치
	private static EvalCall(_name: string, _args: UIValue[], _pos: number): UIValue
	{
		const nums = _args.map((_arg) => BindingResolver.ToNumber(_arg));
		switch (_name)
		{
			case "max": return UIValues.From(Math.max(...nums));
			case "min": return UIValues.From(Math.min(...nums));
			case "abs": return UIValues.From(Math.abs(nums[0] ?? 0));
			case "floor": return UIValues.From(Math.floor(nums[0] ?? 0));
			case "ceil": return UIValues.From(Math.ceil(nums[0] ?? 0));
			case "round": return UIValues.From(Math.round(nums[0] ?? 0));
			case "clamp":
			{
				const v = nums[0] ?? 0;
				const lo = nums[1] ?? 0;
				const hi = nums[2] ?? 0;
				return UIValues.From(Math.min(Math.max(v, lo), hi));
			}
			case "len":
			{
				const first = _args[0] ?? UIValues.Null();
				if (first.Kind === UIValueKind.Array)
					return UIValues.From(first.Value.length);
				if (first.Kind === UIValueKind.String)
					return UIValues.From(first.Value.length);
				if (first.Kind === UIValueKind.Map)
					return UIValues.From(first.Value.size);
				return UIValues.From(0);
			}
			case "str": return { Kind: UIValueKind.String, Value: UIValues.ToDisplay(_args[0] ?? UIValues.Null()) };
			case "num": return UIValues.From(BindingResolver.ToNumber(_args[0] ?? UIValues.Null()));
			default: throw new Error(`[Resolver] 알 수 없는 함수: ${_name} @${_pos}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 숫자 값으로 바꾼다. 문자열은 Number, Bool은 0/1.
	// @param _v: 값
	private static ToNumber(_v: UIValue): number
	{
		switch (_v.Kind)
		{
			case UIValueKind.Int: return _v.Value;
			case UIValueKind.Float: return _v.Value;
			case UIValueKind.Bool: return _v.Value ? 1 : 0;
			case UIValueKind.String: return Number(_v.Value);
			default: return NaN;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 숫자 취급 가능한지 본다.
	// @param _v: 값
	private static IsNumber(_v: UIValue): boolean
	{
		return _v.Kind === UIValueKind.Int || _v.Kind === UIValueKind.Float;
	}
}
