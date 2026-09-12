/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CommandPalette Fuzzy·Recent·소스·창 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIManager, MapLayoutProvider, TextBox, ListBox } from "@scouter/gui";
import type { ITheme } from "@scouter/gui";
import { Fuzzy } from "../../../Scouter.App/Renderer/BuiltIn/CommandPalette/Fuzzy";
import { RecentStore } from "../../../Scouter.App/Renderer/BuiltIn/CommandPalette/RecentStore";
import type { IRecentStorage } from "../../../Scouter.App/Renderer/BuiltIn/CommandPalette/RecentStore";
import { CommandSource } from "../../../Scouter.App/Renderer/BuiltIn/CommandPalette/Sources/CommandSource";
import { SettingsSource } from "../../../Scouter.App/Renderer/BuiltIn/CommandPalette/Sources/SettingsSource";
import { ThemeSource } from "../../../Scouter.App/Renderer/BuiltIn/CommandPalette/Sources/ThemeSource";
import { PaletteWindow } from "../../../Scouter.App/Renderer/BuiltIn/CommandPalette/Views/PaletteWindow";
import { CommandRegistry } from "../../../Scouter.App/Renderer/Services/CommandRegistry";
import { Settings } from "../../../Scouter.App/Renderer/Services/Settings";
import { ThemeManager } from "../../../Scouter.App/Renderer/Theme/ThemeManager";
import schema from "../../../Scouter.App/Config/Settings.schema.json" with { type: "json" };
import defaults from "../../../Scouter.App/Config/Defaults.json" with { type: "json" };

const kPaletteXml = "<Window xmlns=\"scouter/gui\" Name=\"command_palette\" Title=\"t\"><StackPanel Name=\"root\" ContentHost=\"true\" Spacing=\"8\" Margin=\"12\"><TextBox Name=\"txt_query\" Placeholder=\"q\" /><ListBox Name=\"lst_items\" MaxHeight=\"384\" /><TextBlock Name=\"txt_hint\" Text=\"h\" /></StackPanel></Window>";

function MemoryStorage(): IRecentStorage
{
	const data: Record<string, unknown> = {};
	return {
		Get: <T>(_key: string, _def: T): T => (data[_key] as T | undefined) ?? _def,
		Set: (_key: string, _value: unknown): void => { data[_key] = _value; },
	};
}

function TestTheme(_id: string): ITheme
{
	return { Id: _id, Name: _id, Source: "User", Defs: {}, Tokens: {}, HasLight: false, HasDark: true };
}

function TypeText(_box: TextBox, _text: string): void
{
	_box.Text = _text;
	_box.Element.querySelector("input")?.dispatchEvent(new Event("input", { bubbles: true }));
}

function PressKey(_box: TextBox, _key: string): void
{
	const input = _box.Element.querySelector("input") as HTMLElement | null;
	input?.focus();
	input?.dispatchEvent(new KeyboardEvent("keydown", { key: _key, bubbles: true, cancelable: true }));
}

void describe("CommandPalette", () =>
{
	void it("Fuzzy 순서·보너스·실패", () =>
	{
		assert.equal(Fuzzy.Score("", "abc"), 0);
		assert.equal(Fuzzy.Score("xyz", "abc"), null);
		const ordered = Fuzzy.Score("sb", "Sidebar") ?? 0;
		const scattered = Fuzzy.Score("sb", "XxxSyyyyB") ?? 0;
		assert.ok(ordered > scattered);
		const wordStart = Fuzzy.Score("s", "x s") ?? 0;
		const middle = Fuzzy.Score("s", "abcsd") ?? 0;
		assert.ok(wordStart > middle);
	});

	void it("Fuzzy 강조 분할", () =>
	{
		assert.deepEqual(Fuzzy.Highlight("", "ab"), [{ Text: "ab", Match: false }]);
		assert.equal(Fuzzy.Highlight("z", "ab"), null);
		const runs = Fuzzy.Highlight("ac", "abc") ?? [];
		assert.deepEqual(runs.map((_r) => _r.Match), [true, false, true]);
		assert.equal(runs.map((_r) => _r.Text).join(""), "abc");
	});

	void it("Recent bump·지수 감소", () =>
	{
		const storage = MemoryStorage();
		const recent = new RecentStore(storage);
		assert.equal(recent.Weight("nope"), 0);
		recent.Bump("a");
		recent.Bump("a");
		recent.Bump("b");
		assert.ok(recent.Weight("a") > recent.Weight("b"));
		storage.Set("recent", { old: { Count: 10, LastAt: Date.now() - 10 * 86400000 } });
		assert.ok(recent.Weight("old") < 1);
	});

	void it("CommandSource 빈 쿼리·fuzzy·50개 상한", () =>
	{
		const storage = MemoryStorage();
		const recent = new RecentStore(storage);
		const subs: Array<{ Dispose(): void }> = [];
		for (let idx = 0; idx < 60; ++idx)
			subs.push(CommandRegistry.Register({ Id: `Palette.Filler${idx}`, Title: `채우기 ${idx}`, Category: "Palette", Execute: () => undefined }));
		try
		{
			const source = new CommandSource(() => [], recent);
			const all = source.Query("");
			assert.ok(all.length <= 50);
			const found = source.Query("채우기 1");
			assert.ok(found.length > 0 && found.every((_i) => _i.Title.includes("채우기")));
			recent.Bump("채우기 2");
			const top = source.Query("채우기")[0];
			assert.equal(top?.Title, "채우기 2");
		}
		finally
		{
			for (const sub of subs)
				sub.Dispose();
		}
	});

	void it("SettingsSource 키 검색", async () =>
	{
		await Settings.Load(`${process.env["TEMP"] ?? "/tmp"}/scouter-palette-${process.pid}.json`, schema, defaults);
		const source = new SettingsSource();
		const found = source.Query("sidebar");
		assert.ok(found.some((_i) => _i.Title === "Ui.SidebarWidth"));
		assert.equal(source.Query("zz_no_match").length, 0);
	});

	void it("ThemeSource 목록 검색", () =>
	{
		ThemeManager.Register(TestTheme("palette-alpha"));
		ThemeManager.Register(TestTheme("palette-beta"));
		const source = new ThemeSource();
		const found = source.Query("alpha");
		assert.ok(found.some((_i) => _i.Title === "palette-alpha"));
		assert.equal(source.Query("zz_no_match").length, 0);
	});

	void it("창 Up/Down 순환·Enter 실행·ESC 닫기", async () =>
	{
		UIManager.Reset();
		const dom = document.createElement("div");
		document.body.append(dom);
		const provider = new MapLayoutProvider();
		provider.Add("CommandPalette/Palette", kPaletteXml);
		UIManager.Init(dom, provider);
		let ran = false;
		const cmd = CommandRegistry.Register({ Id: "Palette.TestOne", Title: "테스트 하나", Category: "Palette", Execute: () => { ran = true; } });
		const cmd2 = CommandRegistry.Register({ Id: "Palette.TestTwo", Title: "테스트 둘", Category: "Palette", Execute: () => undefined });
		try
		{
			PaletteWindow.Configure({ Plugins: () => [], Storage: MemoryStorage() });
			const win = await UIManager.ShowPopupAsync("CommandPalette/Palette") as PaletteWindow;
			const input = win.RequireName(TextBox, "txt_query");
			const list = win.RequireName(ListBox, "lst_items");
			TypeText(input, "테스트");
			assert.ok(list.Items.length >= 2);
			list.SelectedIndex = 0;
			PressKey(input, "ArrowUp");
			assert.equal(list.SelectedIndex, list.Items.length - 1);
			PressKey(input, "ArrowDown");
			assert.equal(list.SelectedIndex, 0);
			TypeText(input, "하나");
			assert.equal(list.Items.length, 1);
			PressKey(input, "Enter");
			await new Promise((_resolve) => setTimeout(_resolve, 0));
			assert.equal(ran, true);
			assert.equal(win.IsClosed, true);
		}
		finally
		{
			cmd.Dispose();
			cmd2.Dispose();
			dom.remove();
			UIManager.Reset();
		}
	});

	void it("theme 모드 전환 시 원복", async () =>
	{
		UIManager.Reset();
		const dom = document.createElement("div");
		document.body.append(dom);
		const provider = new MapLayoutProvider();
		provider.Add("CommandPalette/Palette", kPaletteXml);
		UIManager.Init(dom, provider);
		try
		{
			await Settings.Load(`${process.env["TEMP"] ?? "/tmp"}/scouter-palette-${process.pid}.json`, schema, defaults);
			Settings.Set("Theme.Id", "palette-alpha");
			PaletteWindow.Configure({ Plugins: () => [], Storage: MemoryStorage() });
			const win = await UIManager.ShowPopupAsync("CommandPalette/Palette") as PaletteWindow;
			const input = win.RequireName(TextBox, "txt_query");
			TypeText(input, "theme beta");
			assert.equal(ThemeManager.Current.Id, "palette-beta");
			TypeText(input, "");
			assert.equal(ThemeManager.Current.Id, "palette-alpha");
			TypeText(input, "theme beta");
			assert.equal(ThemeManager.Current.Id, "palette-beta");
			PressKey(input, "Escape");
			assert.equal(ThemeManager.Current.Id, "palette-alpha");
			assert.equal(win.IsClosed, true);
		}
		finally
		{
			dom.remove();
			UIManager.Reset();
		}
	});
});
