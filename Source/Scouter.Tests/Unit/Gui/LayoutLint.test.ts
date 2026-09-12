/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: LayoutLint 코드별 픽스처 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LayoutLint, LoadContext } from "@scouter/gui";

function Codes(_xml: string): string[]
{
	return LayoutLint.LintXml(_xml, new LoadContext()).map((_m) => _m.Code);
}

void describe("LayoutLint", () =>
{
	void it("E000 파싱 실패", () =>
	{
		assert.ok(Codes("<Window>").includes("E000"));
	});

	void it("E002 ContentHost 위반", () =>
	{
		assert.ok(Codes("<Window><Grid/><Grid/></Window>").includes("E002"));
	});

	void it("E022 미선언 참조", () =>
	{
		assert.ok(Codes("<Window><Grid><StackPanel Opacity=\"{@없음}\"/></Grid></Window>").includes("E022"));
	});

	void it("E023 식 오류·E024 함수", () =>
	{
		assert.ok(Codes("<Window><Grid><StackPanel Opacity=\"{1 +}\"/></Grid></Window>").includes("E023"));
		assert.ok(Codes("<Window><Grid><StackPanel Opacity=\"{nope(1)}\"/></Grid></Window>").includes("E024"));
	});

	void it("E030 중복·W040 명명", () =>
	{
		assert.ok(Codes("<Window><Grid><StackPanel Name=\"a\"/><StackPanel Name=\"a\"/></Grid></Window>").includes("E030"));
		assert.ok(Codes("<Window><Grid><StackPanel Name=\"Bad\"/></Grid></Window>").includes("W040"));
	});

	void it("W060 리터럴 색", () =>
	{
		assert.ok(Codes("<Window Background=\"#fff\"><Grid/></Window>").includes("W060"));
	});

	void it("정상 XML은 빈 배열", () =>
	{
		assert.deepEqual(Codes("<Window><Grid><StackPanel Name=\"ok_list\"/></Grid></Window>"), []);
	});
});
