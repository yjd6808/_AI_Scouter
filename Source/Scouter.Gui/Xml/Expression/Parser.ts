/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 바인딩 Pratt 파서. 보간/식 모드 판정까지 맡는다.
*/

import { Lexer, TokenKind } from "./Lexer";
import type { IToken } from "./Lexer";
import { BindingMode, AstRefs } from "./Ast";
import type { AstNode, IParsedBinding, RefNode } from "./Ast";

const kPrecedenceEntries: Array<[string, number]> = [["?", 1], ["||", 2], ["&&", 3], ["==", 4], ["!=", 4], ["<", 5], ["<=", 5], [">", 5], [">=", 5], ["+", 6], ["-", 6], ["*", 7], ["/", 7], ["%", 7]];
const kPrecedence: Record<string, number> = Object.fromEntries(kPrecedenceEntries);
const kFunctions = new Set(["max", "min", "abs", "floor", "ceil", "round", "clamp", "len", "str", "num"]);

export class ExpressionParser
{
	// ==================== 멤버 ====================
	private tokens_: IToken[] = [];
	private pos_ = 0;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 속성 원문을 바인딩으로 푼다. { }가 없으면 null(리터럴).
	// @param _raw: 속성 원문
	// @param _forceInterpolate: 항상 보간 속성(D-14)이면 true
	public ParseValue(_raw: string, _forceInterpolate: boolean): IParsedBinding | null
	{
		if (!_raw.includes("{"))
			return null;
		const segments = ExpressionParser.Split(_raw);
		const exprs = segments.filter((_seg) => _seg.IsExpr);
		if (!_forceInterpolate && exprs.length === 1 && segments.length === 1)
		{
			const only = exprs[0] as { Text: string; IsExpr: boolean };
			const node = this.ParseSegment(only.Text);
			return { Mode: BindingMode.Expression, Parts: [node], Refs: AstRefs.Collect(node) };
		}
		const parts: Array<string | AstNode> = [];
		const refs: RefNode[] = [];
		for (const seg of segments)
		{
			if (!seg.IsExpr)
			{
				parts.push(seg.Text);
				continue;
			}
			const node = this.ParseSegment(seg.Text);
			parts.push(node);
			refs.push(...AstRefs.Collect(node));
		}
		if (!_forceInterpolate && ExpressionParser.HasOuterOperator(segments))
		{
			const node = this.ParseText(_raw);
			return { Mode: BindingMode.Expression, Parts: [node], Refs: AstRefs.Collect(node) };
		}
		return { Mode: BindingMode.Interpolate, Parts: parts, Refs: refs };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 식 텍스트 1개를 AST로 푼다.
	// @param _text: 식 원문
	public ParseText(_text: string): AstNode
	{
		this.tokens_ = new Lexer(_text).Tokenize();
		this.pos_ = 0;
		const node = this.ParseExpr(0);
		const end = this.Peek();
		if (end.Kind !== TokenKind.End)
			throw new Error(`E023 남는 토큰: ${end.Text} @${end.Pos}`);
		return node;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 조각 안쪽 1개를 푼다. @# $ 단일 참조는 중괄호로 감싸 재시도.
	// @param _inner: 조각 안쪽
	private ParseSegment(_inner: string): AstNode
	{
		try
		{
			return this.ParseText(_inner);
		}
		catch (_first)
		{
			if (!/^[@#$]/.test(_inner.trim()))
				throw _first;
			return this.ParseText(`{${_inner}}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 원문을 리터럴·식 조각으로 나눈다. 백틱 안 중괄호는 무시.
	// @param _raw: 원문
	private static Split(_raw: string): Array<{ Text: string; IsExpr: boolean }>
	{
		const out: Array<{ Text: string; IsExpr: boolean }> = [];
		let plain = "";
		let idx = 0;
		const pushPlain = (): void =>
		{
			if (plain.length > 0)
			{
				out.push({ Text: plain, IsExpr: false });
				plain = "";
			}
		};
		while (idx < _raw.length)
		{
			const ch = _raw[idx] as string;
			if (ch === "`")
			{
				plain += ch;
				idx++;
				while (idx < _raw.length)
				{
					const inner = _raw[idx] as string;
					plain += inner;
					idx++;
					if (inner === "\\" && idx < _raw.length)
					{
						plain += _raw[idx] as string;
						idx++;
						continue;
					}
					if (inner === "`")
						break;
				}
				continue;
			}
			if (ch === "{")
			{
				let depth = 1;
				let end = idx + 1;
				while (end < _raw.length && depth > 0)
				{
					if (_raw[end] === "{")
						depth++;
					else if (_raw[end] === "}")
						depth--;
					end++;
				}
				if (depth !== 0)
					throw new Error(`E023 중괄호 미종결 @${idx}`);
				pushPlain();
				out.push({ Text: _raw.slice(idx + 1, end - 1), IsExpr: true });
				idx = end;
				continue;
			}
			plain += ch;
			idx++;
		}
		pushPlain();
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 리터럴 조각 바깥에 연산자가 있는지 본다. 있으면 전체를 식으로.
	// @param _segments: 조각 목록
	private static HasOuterOperator(_segments: Array<{ Text: string; IsExpr: boolean }>): boolean
	{
		for (const seg of _segments)
		{
			if (seg.IsExpr)
				continue;
			let inTick = false;
			for (let idx = 0; idx < seg.Text.length; ++idx)
			{
				const ch = seg.Text[idx] as string;
				if (ch === "`")
					inTick = !inTick;
				else if (!inTick && "+-*/%<>=!&|?:".includes(ch))
					return true;
			}
		}
		return false;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 토큰을 본다.
	private Peek(): IToken
	{
		return this.tokens_[this.pos_] as IToken;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰을 소비한다.
	private Next(): IToken
	{
		const tok = this.tokens_[this.pos_] as IToken;
		this.pos_++;
		return tok;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 우선순위 상승 파싱.
	// @param _minPrec: 최소 우선순위
	private ParseExpr(_minPrec: number): AstNode
	{
		let left = this.ParseUnary();
		for (;;)
		{
			const tok = this.Peek();
			const prec = tok.Kind === TokenKind.Operator || tok.Kind === TokenKind.Question ? (kPrecedence[tok.Text] ?? 0) : 0;
			if (prec === 0 || prec < _minPrec)
				return left;
			this.Next();
			if (tok.Text === "?")
			{
				const whenTrue = this.ParseExpr(1);
				this.Expect(":");
				const whenFalse = this.ParseExpr(1);
				left = { Kind: "Ternary", Cond: left, WhenTrue: whenTrue, WhenFalse: whenFalse, Pos: tok.Pos };
				continue;
			}
			const right = this.ParseExpr(prec + 1);
			left = { Kind: "Binary", Op: tok.Text, Left: left, Right: right, Pos: tok.Pos };
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 단항·기본 파싱.
	private ParseUnary(): AstNode
	{
		const tok = this.Peek();
		if (tok.Kind === TokenKind.Operator && (tok.Text === "!" || tok.Text === "-"))
		{
			this.Next();
			return { Kind: "Unary", Op: tok.Text, Operand: this.ParseUnary(), Pos: tok.Pos };
		}
		return this.ParsePrimary();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기본 파싱. 리터럴·참조·호출·괄호.
	private ParsePrimary(): AstNode
	{
		const tok = this.Next();
		switch (tok.Kind)
		{
			case TokenKind.Number: return { Kind: "Literal", Text: tok.Text, Pos: tok.Pos };
			case TokenKind.String: return { Kind: "Literal", Text: `\`${tok.Text}\``, Pos: tok.Pos };
			case TokenKind.Ref:
				if (tok.Ref === undefined)
					throw new Error(`E023 참조 없음 @${tok.Pos}`);
				return { Kind: "Ref", Ref: tok.Ref };
			case TokenKind.Ident:
				if (tok.Text === "true" || tok.Text === "false" || tok.Text === "null")
					return { Kind: "Literal", Text: tok.Text, Pos: tok.Pos };
				if (this.Peek().Kind === TokenKind.LParen)
					return this.ParseCall(tok);
				throw new Error(`E023 알 수 없는 식별자: ${tok.Text} @${tok.Pos}`);
			case TokenKind.LParen:
			{
				const inner = this.ParseExpr(0);
				this.Expect(")");
				return inner;
			}
			default:
				throw new Error(`E023 식 오류: ${tok.Text} @${tok.Pos}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 함수 호출 파싱.
	// @param _name: 이름 토큰
	private ParseCall(_name: IToken): AstNode
	{
		if (!kFunctions.has(_name.Text))
			throw new Error(`E024 알 수 없는 함수: ${_name.Text} @${_name.Pos}`);
		this.Next();
		const args: AstNode[] = [];
		if (this.Peek().Kind !== TokenKind.RParen)
		{
			for (;;)
			{
				args.push(this.ParseExpr(0));
				if (this.Peek().Kind === TokenKind.Comma)
				{
					this.Next();
					continue;
				}
				break;
			}
		}
		this.Expect(")");
		return { Kind: "Call", Name: _name.Text, Args: args, Pos: _name.Pos };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기대 토큰을 소비한다.
	// @param _text: 기대 텍스트
	private Expect(_text: string): void
	{
		const tok = this.Next();
		if (tok.Text !== _text)
			throw new Error(`E023 ${_text} 기대, 실제 ${tok.Text} @${tok.Pos}`);
	}
}
