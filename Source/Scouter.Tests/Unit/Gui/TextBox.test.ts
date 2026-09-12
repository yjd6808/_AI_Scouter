/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: TextBox 입력·커밋 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TextBox } from "@scouter/gui";

void describe("TextBox", () =>
{
	void it("input 이벤트가 Text를 갱신한다", () =>
	{
		const box = new TextBox();
		document.body.append(box.Element);
		const input = box.Element.querySelector("input") as HTMLInputElement;
		input.value = "hello";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		assert.equal(box.Text, "hello");
		box.Dispose();
	});

	void it("Text 설정이 value에 반영된다", () =>
	{
		const box = new TextBox();
		box.Text = "abc";
		const input = box.Element.querySelector("input") as HTMLInputElement;
		assert.equal(input.value, "abc");
		box.Placeholder = "ph";
		assert.equal(input.placeholder, "ph");
		box.IsReadOnly = true;
		assert.equal(input.readOnly, true);
		box.SelectAll();
		box.Dispose();
	});

	void it("Enter가 TextCommitted를 쏜다", () =>
	{
		const box = new TextBox();
		document.body.append(box.Element);
		let committed = 0;
		box.TextCommitted.Add(() => { committed++; });
		const input = box.Element.querySelector("input") as HTMLInputElement;
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		assert.equal(committed, 1);
		box.Dispose();
	});
});
