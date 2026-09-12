/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 렉서·파서 AST 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Lexer, TokenKind, ExpressionParser } from "@scouter/gui";

void describe("LexerParser", () =>
{
	void it("Ref 토큰 3종", () =>
	{
		const toks = new Lexer("{@k} + {#n.p}").Tokenize();
		const first = toks.at(0);
		const third = toks.at(2);
		assert.equal(first?.Kind, TokenKind.Ref);
		assert.equal(third?.Kind, TokenKind.Ref);
		const firstRef = first.Ref;
		const thirdRef = third.Ref;
		assert.equal(firstRef.Kind, "DataRef");
		assert.equal(thirdRef?.Kind, "ElementRef");
	});

	void it("우선순위: +가 *보다 낮다", () =>
	{
		const node = new ExpressionParser().ParseText("{@a} + {@b} * 2");
		switch (node.Kind)
		{
			case "Binary": assert.equal(node.Op, "+"); break;
			default: assert.fail("Binary 기대"); break;
		}
	});

	void it("삼항 중첩", () =>
	{
		const node = new ExpressionParser().ParseText("{@a} ? `{x}` : `{y}`");
		assert.equal(node.Kind, "Ternary");
	});

	void it("보간 모드 분리", () =>
	{
		const parsed = new ExpressionParser().ParseValue("Rev {@rev} / {@max}", true);
		assert.notEqual(parsed, null);
		assert.equal(parsed?.Parts.length, 4);
	});

	void it("식 모드 단일", () =>
	{
		const parsed = new ExpressionParser().ParseValue("!{@isRunning}", false);
		assert.equal(parsed?.Mode, "Expression");
	});

	void it("오류 위치 포함", () =>
	{
		assert.throws(() => new ExpressionParser().ParseText("{@a} +"), /E023/);
		assert.throws(() => new ExpressionParser().ParseText("nope(1)"), /E024/);
		assert.throws(() => new Lexer("{oops}").Tokenize(), /E023/);
	});
});
