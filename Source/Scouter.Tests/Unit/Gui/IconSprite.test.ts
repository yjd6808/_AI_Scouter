/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: IconSprite 주입 테스트. 정적 파일(Styles/Icons.svg) 동기화 검사 포함.
*/

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { IconSprite } from "@scouter/gui";

const kSvgPath = fileURLToPath(new URL("../../../Scouter.Gui/Styles/Icons.svg", import.meta.url));

function SvgIds(): string[]
{
	const text = fs.readFileSync(kSvgPath, "utf-8");
	const out: string[] = [];
	for (const found of text.matchAll(/<symbol id="([^"]+)"/g))
		out.push(found[1] as string);
	return out;
}

void describe("IconSprite", () =>
{
	after(() =>
	{
		IconSprite.ResetForTest();
		IconSprite.Ensure();
	});

	void it("심볼이 1회만 주입된다", () =>
	{
		IconSprite.ResetForTest();
		IconSprite.Ensure();
		IconSprite.Ensure();
		const nodes = document.querySelectorAll("#scouter-icon-sprite");
		assert.equal(nodes.length, 1);
		const svg = document.getElementById("scouter-icon-sprite");
		assert.ok(svg?.querySelector("#lucide-x") !== null);
		assert.ok(svg?.querySelector("#lucide-chrome-minimize") !== null);
		assert.ok(svg?.querySelector("#lucide-square") !== null);
		assert.ok(svg?.querySelector("#lucide-pin") !== null);
		assert.ok(svg?.querySelector("#lucide-pin-off") !== null);
	});

	void it("Ids에 창 버튼이 있다", () =>
	{
		const ids = IconSprite.Ids();
		assert.ok(ids.includes("lucide-chrome-minimize"));
		assert.ok(ids.includes("lucide-square"));
		assert.ok(ids.includes("lucide-copy"));
		assert.ok(ids.includes("lucide-x"));
		assert.ok(ids.includes("lucide-pin"));
		assert.ok(ids.includes("lucide-chevrons-left"));
		assert.ok(ids.includes("lucide-chevrons-right"));
	});

	void it("Plugin 공용 범용 심볼이 등록되어 있다", () =>
	{
		const ids = IconSprite.Ids();
		const wanted = [
			"chevron-right", "plus", "check", "trash", "bell",
			"alarm-clock", "clock", "timer", "play", "pause", "file-text", "command",
		];
		for (const name of wanted)
			assert.ok(ids.includes(`lucide-${name}`), name);
	});

	void it("Has가 등록 여부를 답한다", () =>
	{
		assert.equal(IconSprite.Has("bell"), true);
		assert.equal(IconSprite.Has("lucide-bell"), true);
		assert.equal(IconSprite.Has("package"), true);
		assert.equal(IconSprite.Has("notes"), false);
		assert.equal(IconSprite.Has("p4"), false);
		assert.equal(IconSprite.Has(""), false);
	});

	void it("심볼은 viewBox 0 0 24 24로 주입된다", () =>
	{
		IconSprite.ResetForTest();
		IconSprite.Ensure();
		const svg = document.getElementById("scouter-icon-sprite");
		assert.ok(svg !== null);
		const symbols = [...svg.querySelectorAll("symbol")];
		assert.equal(symbols.length, IconSprite.Ids().length);
		for (const symbol of symbols)
		{
			assert.equal(symbol.getAttribute("viewBox"), "0 0 24 24");
			assert.ok((symbol.innerHTML.length) > 0, symbol.id);
		}
	});

	void it("런타임 스프라이트와 정적 Icons.svg가 같다", () =>
	{
		assert.deepEqual(SvgIds(), IconSprite.Ids());
	});
});
