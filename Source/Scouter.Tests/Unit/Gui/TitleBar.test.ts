/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: TitleBar 창 버튼 테스트. 고정 포함 4버튼.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TitleBar, SimpleEvent } from "@scouter/gui";
import type { IWindowChrome } from "@scouter/gui";

class FakeChrome implements IWindowChrome
{
	// ==================== 멤버 ====================
	public Topmost = false;

	// ==================== 이벤트 ====================
	public readonly MaximizedChanged = new SimpleEvent<boolean>();
	public readonly TopmostChanged = new SimpleEvent<boolean>();

	// ==================== 공개 메서드 ====================
	public Minimize(): void
	{
	}

	public ToggleMaximize(): void
	{
	}

	public Close(): void
	{
	}

	public IsMaximized(): Promise<boolean>
	{
		return Promise.resolve(false);
	}

	public IsTopmost(): Promise<boolean>
	{
		return Promise.resolve(this.Topmost);
	}

	public ToggleTopmost(): Promise<boolean>
	{
		this.Topmost = !this.Topmost;
		return Promise.resolve(this.Topmost);
	}
}

function ButtonsOf(_bar: TitleBar): Element[]
{
	return [..._bar.Element.children].filter((_el) => _el.tagName === "BUTTON");
}

function HrefOf(_button: Element): string | null
{
	return _button.querySelector("use")?.getAttribute("href") ?? null;
}

async function Flush(): Promise<void>
{
	await new Promise((_resolve) => setTimeout(_resolve, 0));
}

void describe("TitleBar", () =>
{
	void it("고정 포함 4버튼을 그린다", async () =>
	{
		const bar = new TitleBar();
		const chrome = new FakeChrome();
		bar.Chrome = chrome;
		await Flush();
		const buttons = ButtonsOf(bar);
		assert.equal(buttons.length, 4);
		assert.equal(HrefOf(buttons[0] as Element), "#lucide-minus");
		assert.equal(HrefOf(buttons[1] as Element), "#lucide-pin");
		assert.equal(HrefOf(buttons[2] as Element), "#lucide-square");
		assert.equal(HrefOf(buttons[3] as Element), "#lucide-x");
		bar.Dispose();
		assert.equal(chrome.MaximizedChanged.HasHandlers, false);
		assert.equal(chrome.TopmostChanged.HasHandlers, false);
	});

	void it("고정·최대화 변경에 아이콘이 바뀐다", async () =>
	{
		const bar = new TitleBar();
		const chrome = new FakeChrome();
		bar.Chrome = chrome;
		await Flush();
		chrome.TopmostChanged.Invoke(true);
		assert.equal(HrefOf(ButtonsOf(bar)[1] as Element), "#lucide-pin-off");
		chrome.MaximizedChanged.Invoke(true);
		assert.equal(HrefOf(ButtonsOf(bar)[2] as Element), "#lucide-copy");
		chrome.MaximizedChanged.Invoke(false);
		assert.equal(HrefOf(ButtonsOf(bar)[2] as Element), "#lucide-square");
		bar.Dispose();
	});
});
