/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: SpeechExecutor 단위 테스트. 트리거 매칭 순수 함수.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Normalize, Similarity, IsTrigger, ParseHostPort } from "../../../../Plugins/SpeechExecutor/Types";

void describe("SpeechExecutor", () =>
{
	void it("공백·문장부호 무시", () =>
	{
		assert.equal(Normalize("몬스터 무적!"), Normalize("몬스터무적"));
		assert.equal(Normalize("완 료."), "완료");
	});
	void it("유사도", () =>
	{
		assert.equal(Similarity("완료", "완료"), 1);
		assert.ok(Similarity("완료", "완료.") > 0.8);
		assert.ok(Similarity("완료", "지우기") < 0.8);
	});
	void it("트리거 매칭", () =>
	{
		assert.ok(IsTrigger("지우기", "지우기"));
		assert.ok(IsTrigger("지우기!", "지우기;완료"));
		assert.ok(IsTrigger("이제 완료", "완료"));
		assert.ok(!IsTrigger("지워줘", "완료"));
		assert.ok(!IsTrigger("아무말", ""));
	});
	void it("호스트 파싱", () =>
	{
		assert.deepEqual(ParseHostPort("0.0.0.0:9999"), { Host: "0.0.0.0", Port: 9999 });
		assert.deepEqual(ParseHostPort("172.30.1.43:9999"), { Host: "172.30.1.43", Port: 9999 });
		assert.equal(ParseHostPort("9999"), null);
		assert.equal(ParseHostPort("host:0"), null);
	});
});
