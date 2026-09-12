/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 바인딩 렉서. {@} {#} {$}를 Ref 토큰 하나로 자른다.
*/

import type { RefNode } from "./Ast";

export enum TokenKind
{
	Number = "Number",
	String = "String",
	Ref = "Ref",
	Ident = "Ident",
	Operator = "Operator",
	LParen = "LParen",
	RParen = "RParen",
	Comma = "Comma",
	Question = "Question",
	Colon = "Colon",
	End = "End",
}

export interface IToken
{
	Kind: TokenKind;
	Text: string;
	Pos: number;
	Ref?: RefNode;
}

const kTwoCharOps = new Set(["==", "!=", "<=", ">=", "&&", "||"]);
const kOneCharOps = new Set(["<", ">", "+", "-", "*", "/", "%", "!"]);

export class Lexer
{
	// ==================== 멤버 ====================
	private readonly text_: string;
	private pos_ = 0;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 식 원문으로 시작한다.
	// @param _text: 식 원문 ({ } 안쪽)
	public constructor(_text: string)
	{
		this.text_ = _text;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 토큰을 잘라 반환한다. 마지막은 End.
	public Tokenize(): IToken[]
	{
		const out: IToken[] = [];
		for (;;)
		{
			this.SkipSpaces();
			if (this.pos_ >= this.text_.length)
			{
				out.push({ Kind: TokenKind.End, Text: "", Pos: this.pos_ });
				return out;
			}
			out.push(this.Next());
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 공백을 건너뛴다.
	private SkipSpaces(): void
	{
		while (this.pos_ < this.text_.length && /\s/.test(this.text_[this.pos_] as string))
			this.pos_++;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰 1개를 자른다.
	private Next(): IToken
	{
		const start = this.pos_;
		const ch = this.text_[start] as string;
		if (ch === "{")
			return this.ReadRef();
		if (ch === "`")
			return this.ReadString();
		if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(this.text_[start + 1] ?? "")))
			return this.ReadNumber();
		if (/[A-Za-z_]/.test(ch))
			return this.ReadIdent();
		if (ch === "(")
		{
			this.pos_++;
			return { Kind: TokenKind.LParen, Text: "(", Pos: start };
		}
		if (ch === ")")
		{
			this.pos_++;
			return { Kind: TokenKind.RParen, Text: ")", Pos: start };
		}
		if (ch === ",")
		{
			this.pos_++;
			return { Kind: TokenKind.Comma, Text: ",", Pos: start };
		}
		if (ch === "?")
		{
			this.pos_++;
			return { Kind: TokenKind.Question, Text: "?", Pos: start };
		}
		if (ch === ":")
		{
			this.pos_++;
			return { Kind: TokenKind.Colon, Text: ":", Pos: start };
		}
		const two = this.text_.slice(start, start + 2);
		if (kTwoCharOps.has(two))
		{
			this.pos_ += 2;
			return { Kind: TokenKind.Operator, Text: two, Pos: start };
		}
		if (kOneCharOps.has(ch))
		{
			this.pos_++;
			return { Kind: TokenKind.Operator, Text: ch, Pos: start };
		}
		throw new Error(`E023 알 수 없는 문자: ${ch} @${start}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 백틱 문자열을 자른다.
	private ReadString(): IToken
	{
		const start = this.pos_;
		this.pos_++;
		let out = "";
		for (;;)
		{
			if (this.pos_ >= this.text_.length)
				throw new Error(`E023 문자열 미종결 @${start}`);
			const ch = this.text_[this.pos_] as string;
			if (ch === "\\" && this.pos_ + 1 < this.text_.length)
			{
				out += this.text_[this.pos_ + 1] as string;
				this.pos_ += 2;
				continue;
			}
			if (ch === "`")
			{
				this.pos_++;
				return { Kind: TokenKind.String, Text: out, Pos: start };
			}
			out += ch;
			this.pos_++;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 숫자를 자른다.
	private ReadNumber(): IToken
	{
		const start = this.pos_;
		while (this.pos_ < this.text_.length && /[0-9.]/.test(this.text_[this.pos_] as string))
			this.pos_++;
		return { Kind: TokenKind.Number, Text: this.text_.slice(start, this.pos_), Pos: start };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 식별자·true/false/null을 자른다.
	private ReadIdent(): IToken
	{
		const start = this.pos_;
		while (this.pos_ < this.text_.length && /[A-Za-z0-9_]/.test(this.text_[this.pos_] as string))
			this.pos_++;
		return { Kind: TokenKind.Ident, Text: this.text_.slice(start, this.pos_), Pos: start };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// {…} 참조를 통째로 자른다. 안쪽 공백 금지.
	private ReadRef(): IToken
	{
		const start = this.pos_;
		const end = this.text_.indexOf("}", start + 1);
		if (end < 0)
			throw new Error(`E023 참조 미종결 @${start}`);
		const inner = this.text_.slice(start + 1, end);
		if (/\s/.test(inner))
			throw new Error(`E023 참조 안 공백 금지 @${start}`);
		this.pos_ = end + 1;
		return { Kind: TokenKind.Ref, Text: this.text_.slice(start, end + 1), Pos: start, Ref: Lexer.ParseRef(inner, start) };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 참조 안쪽을 구조화한다.
	// @param _inner: { } 안쪽
	// @param _pos: 위치
	public static ParseRef(_inner: string, _pos: number): RefNode
	{
		if (_inner.startsWith("@"))
			return { Kind: "DataRef", Key: _inner.slice(1), Pos: _pos };
		if (_inner.startsWith("#"))
		{
			const dot = _inner.indexOf(".");
			if (dot < 0)
				throw new Error(`E023 {#이름.속성} 형식 아님 @${_pos}`);
			return { Kind: "ElementRef", Name: _inner.slice(1, dot), Prop: _inner.slice(dot + 1), Pos: _pos };
		}
		if (_inner.startsWith("$"))
		{
			const body = _inner.slice(1);
			const ancestor = /^\ancestor\((\d+)\)\.(.+)$/.exec(body);
			if (ancestor !== null)
				return { Kind: "SpecialRef", Source: "ancestor", Path: [ancestor[1] as string, ancestor[2] as string], Pos: _pos };
			const parts = body.split(".");
			return { Kind: "SpecialRef", Source: parts[0] as string, Path: parts.slice(1), Pos: _pos };
		}
		throw new Error(`E023 알 수 없는 참조: ${_inner} @${_pos}`);
	}
}
