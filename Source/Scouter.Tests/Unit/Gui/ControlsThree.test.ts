/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P10 Scouter 컨트롤 테스트. 테마·마크다운·아바타.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MonacoTheme } from "@scouter/gui";
import { MarkdownView } from "@scouter/gui";
import { Avatar } from "@scouter/gui";
import { CodeEditor } from "@scouter/gui";

void describe("ControlsThree", () =>
{
	void it("MonacoTheme 토큰 매핑·누락", () =>
	{
		const tokens = new Map<string, string>([
			["background-base", "#111111"],
			["text-base", "#eeeeee"],
			["syntax-keyword", "#ff0000"],
			["syntax-comment", "#00ff00"],
		]);
		const dark = MonacoTheme.FromTokens(tokens, true);
		assert.equal(dark.base, "vs-dark");
		assert.equal(dark.colors["editor.background"], "#111111");
		assert.ok(dark.rules.some((_r) => _r.token === "keyword" && _r.foreground === "ff0000"));
		assert.ok(dark.rules.some((_r) => _r.token === "comment"));
		assert.ok(!dark.rules.some((_r) => _r.token === "string"));
		const light = MonacoTheme.FromTokens(tokens, false);
		assert.equal(light.base, "vs");
		const empty = MonacoTheme.FromTokens(new Map(), true);
		assert.equal(empty.rules.length, 0);
		assert.equal(empty.colors["editor.background"], "#1e1e1e");
	});

	void it("MarkdownView GFM·링크", () =>
	{
		// script/style/iframe 제거는 DOMPurify 표준 동작으로 Electron에서 확인.
		// happy-dom은 삽입 스크립트를 실행해서 해당 입력은 단위 테스트에서 제외.
		const view = new MarkdownView();
		let href = "";
		view.LinkRequested.Add((_s, _a) => { href = _a.Href; });
		view.Source = "# 제목\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n[보기](https://example.com/x)";
		const body = view.Element.querySelector(".gui-markdown__body") as HTMLElement;
		assert.ok(body.querySelector("table") !== null);
		const anchor = body.querySelector("a[href]") as HTMLAnchorElement;
		anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		assert.equal(href, "https://example.com/x");
	});

	void it("Avatar 이니셜·이미지", () =>
	{
		const avatar = new Avatar();
		avatar.Text = "홍 길동";
		avatar.Size = 32;
		assert.equal(avatar.Element.textContent, "홍길");
		assert.equal(avatar.Element.style.width, "32px");
		avatar.Source = "https://example.com/a.png";
		assert.ok(avatar.Element.querySelector("img") !== null);
	});

	void it("CodeEditor 생성만(로드 없음)", () =>
	{
		const editor = new CodeEditor();
		editor.Language = "typescript";
		editor.Text = "const a = 1;";
		assert.equal(editor.Text, "const a = 1;");
		assert.equal(editor.Language, "typescript");
		editor.Dispose();
	});
});
