/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: 내장 데스크톱 테마 테스트. 37종 파싱·스킴·대비.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ThemeResolver, kCoreTokens, kDesktopCoreAliases } from "@scouter/gui";
import { ThemeLoader } from "../../../Scouter.App/Renderer/Theme/ThemeLoader";
import { kDesktopThemes } from "../../../Scouter.App/Renderer/Theme/DesktopThemes";

const kSkipMagenta = new Set(["shadow", "shadow-md"]);

function Luminance(_hex: string): number
{
	const found = /^#([0-9a-f]{6})/i.exec(_hex);
	if (found === null)
		return -1;
	const num = parseInt(found[1] as string, 16);
	const lift = (_v: number): number =>
	{
		const s = _v / 255;
		return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lift((num >> 16) & 255) + 0.7152 * lift((num >> 8) & 255) + 0.0722 * lift(num & 255);
}

function Contrast(_a: string, _b: string): number
{
	const x = Luminance(_a);
	const y = Luminance(_b);
	if (x < 0 || y < 0)
		return -1;
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

void describe("ThemeDesktop", () =>
{
	void it("37종이 묶여 있다", () =>
	{
		assert.equal(kDesktopThemes.length, 37);
	});

	void it("전부 파싱되고 스킴이 갈린다", () =>
	{
		for (const entry of kDesktopThemes)
		{
			const theme = ThemeLoader.ParseDesktop(entry.Id, entry.Json, "BuiltIn");
			assert.equal(theme.HasLight, true);
			assert.equal(theme.HasDark, true);
			const dark = theme.Desktop?.Dark["background-base"];
			const light = theme.Desktop?.Light["background-base"];
			assert.match(dark ?? "", /^#/);
			assert.match(light ?? "", /^#/);
			assert.notEqual(dark, light);
		}
	});

	void it("코어 토큰에 마젠타가 없다", () =>
	{
		for (const entry of kDesktopThemes)
		{
			const theme = ThemeLoader.ParseDesktop(entry.Id, entry.Json, "BuiltIn");
			for (const scheme of ["Dark", "Light"] as const)
			{
				const resolved = ThemeResolver.Resolve(theme, scheme, null);
				const raw = scheme === "Dark" ? theme.Desktop?.Dark : theme.Desktop?.Light;
				for (const token of kCoreTokens)
				{
					if (kSkipMagenta.has(token))
						continue;
					if (resolved.Tokens.get(token) !== "#ff00ff")
						continue;
					const alias = kDesktopCoreAliases.get(token) ?? token;
					assert.equal(raw?.[alias]?.toLowerCase(), "#ff00ff", `${entry.Id}/${scheme}/${token}`);
				}
			}
		}
	});

	void it("oc-2 라이트 결함이 보정된다", () =>
	{
		const found = kDesktopThemes.find((_e) => _e.Id === "oc-2");
		assert.ok(found !== undefined);
		const theme = ThemeLoader.ParseDesktop(found.Id, found.Json, "BuiltIn");
		assert.equal(theme.Desktop?.Light["icon-weak-base"], "#C7C7C7");
	});

	void it("패널 배경은 스킴 쪽에 붙는다", () =>
	{
		for (const entry of kDesktopThemes)
		{
			const theme = ThemeLoader.ParseDesktop(entry.Id, entry.Json, "BuiltIn");
			for (const scheme of ["Dark", "Light"] as const)
			{
				const resolved = ThemeResolver.Resolve(theme, scheme, null);
				const panel = resolved.Tokens.get("background-panel") ?? "?";
				if (scheme === "Light")
					assert.ok(Luminance(panel) > 0.5, `${entry.Id}/panel-light`);
				else
					assert.ok(Luminance(panel) < 0.4, `${entry.Id}/panel-dark`);
			}
		}
	});

	void it("본문·보조·강조 대비가 깨지지 않는다", () =>
	{
		for (const entry of kDesktopThemes)
		{
			const theme = ThemeLoader.ParseDesktop(entry.Id, entry.Json, "BuiltIn");
			for (const scheme of ["Dark", "Light"] as const)
			{
				const resolved = ThemeResolver.Resolve(theme, scheme, null);
				const get = (_key: string): string => resolved.Tokens.get(_key) ?? "?";
				const back = get("background-base");
				assert.match(get("text-base"), /^#[0-9a-f]{6}$/i, `${entry.Id}/${scheme}/text-hex`);
				assert.ok(Contrast(get("text-base"), back) >= 4.5, `${entry.Id}/${scheme}/text`);
				assert.ok(Contrast(get("text-weak"), back) >= 3, `${entry.Id}/${scheme}/weak`);
				assert.ok(Contrast(get("text-strong"), back) >= 4.5, `${entry.Id}/${scheme}/strong`);
			}
		}
	});
});
