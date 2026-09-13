/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeManager. 선택·스킴·적용·감시를 한 곳에.
*/

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { watch } from "chokidar";
import type { FSWatcher } from "chokidar";
import { ThemeResolver, ThemeCss, SimpleEvent } from "@scouter/gui";
import type { ITheme, IResolvedTheme, IThemeJson, ThemeMode, ThemeScheme, ITypography, DensityKind } from "@scouter/gui";
import { MonacoLoader } from "@scouter/gui";
import { Settings } from "../Services/Settings";
import { EventBus } from "../Services/EventBus";
import { ThemeLoader } from "./ThemeLoader";
import { kDesktopThemes } from "./DesktopThemes";
import oc2Json from "./Themes/oc-2.json" with { type: "json" };

export interface IThemeChanged
{
	Id: string;
	Name: string;
	Scheme: ThemeScheme;
}

export class ThemeManager
{
	// ==================== 정적 ====================
	private static readonly s_themes_ = new Map<string, ITheme>();
	private static readonly s_raws_ = new Map<string, IThemeJson>();
	private static s_current_: ITheme | null = null;
	private static s_preview_: ITheme | null = null;
	private static s_resolved_: IResolvedTheme | null = null;
	private static s_style_: HTMLStyleElement | null = null;
	private static s_media_: MediaQueryList | null = null;
	private static s_watcher_: FSWatcher | null = null;
	private static readonly s_changed_ = new SimpleEvent<IThemeChanged>();

	// ==================== 속성 ====================
	public static get Changed(): SimpleEvent<IThemeChanged> { return ThemeManager.s_changed_; }

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 테마를 구한다. 미초기화면 throw.
	public static get Current(): ITheme
	{
		if (ThemeManager.s_current_ === null)
			throw new Error("[ThemeManager] 미초기화");
		return ThemeManager.s_current_;
	}

	public static get Resolved(): IResolvedTheme | null { return ThemeManager.s_resolved_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 내장+사용자 테마를 읽고 설정을 적용한다.
	// @param _userDir: ~/.scouter/themes
	public static async InitAsync(_userDir: string): Promise<void>
	{
		const oc2 = ThemeLoader.Parse("oc-2", oc2Json, "BuiltIn");
		ThemeManager.s_themes_.set(oc2.Id, oc2);
		ThemeManager.s_raws_.set(oc2.Id, oc2Json);
		ThemeManager.s_current_ = oc2;
		ThemeManager.LoadBundledDesktop();
		for (const theme of await ThemeLoader.LoadDirAsync(_userDir, "User"))
			ThemeManager.s_themes_.set(theme.Id, theme);
		ThemeManager.s_style_ = document.createElement("style");
		ThemeManager.s_style_.id = "scouter-theme";
		document.head.append(ThemeManager.s_style_);
		ThemeManager.s_media_ = window.matchMedia("(prefers-color-scheme: dark)");
		ThemeManager.s_media_.addEventListener("change", () =>
		{
			ThemeManager.Apply();
		});
		ThemeManager.Apply();
		try
		{
			ThemeManager.s_watcher_ = watch(_userDir, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 100 } });
			ThemeManager.s_watcher_.on("add", (_file) => void ThemeManager.ReloadFile(_file));
			ThemeManager.s_watcher_.on("change", (_file) => void ThemeManager.ReloadFile(_file));
		}
		catch
		{
			// 감시 실패는 무시.
		}
		Settings.Changed.Add((_change) =>
		{
			if (_change.Key.startsWith("Theme."))
				ThemeManager.Apply();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마를 등록한다. 같은 Id면 User 우선(호출 순서로).
	// @param _theme: 테마
	public static Register(_theme: ITheme): void
	{
		ThemeManager.s_themes_.set(_theme.Id, _theme);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록을 반환한다.
	public static List(): Array<{ Id: string; Name: string; Source: string }>
	{
		return [...ThemeManager.s_themes_.values()].map((_t) => ({ Id: _t.Id, Name: _t.Name, Source: _t.Source }));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마를 바꾼다. 없으면 false. 저장은 호출자가 Settings로 한다.
	// @param _id: Id
	public static Set(_id: string): boolean
	{
		return ThemeManager.Preview(_id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마를 미리본다. Settings에 기록하지 않는다. 확정·원복은 호출자 몫.
	// @param _id: Id
	public static Preview(_id: string): boolean
	{
		const found = ThemeManager.s_themes_.get(_id);
		if (found === undefined)
			return false;
		ThemeManager.s_preview_ = found;
		ThemeManager.s_current_ = found;
		ThemeManager.Render(found);
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 원본 JSON을 구한다. ThemeCreate 파생용.
	// @param _id: Id
	public static RawOf(_id: string): IThemeJson | null
	{
		return ThemeManager.s_raws_.get(_id) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 지금 CSS를 다시 쓴다. 설정 Id를 기준으로 삼는다. 바뀌었을 때만 DOM 터치.
	public static Apply(): void
	{
		if (ThemeManager.s_current_ === null || ThemeManager.s_style_ === null)
			return;
		const id = Settings.Get<string>("Theme.Id", "oc-2");
		const saved = ThemeManager.s_themes_.get(id) ?? ThemeManager.s_themes_.get("oc-2") ?? null;
		if (ThemeManager.s_preview_ !== null && saved !== null && ThemeManager.s_preview_.Id !== saved.Id)
		{
			ThemeManager.Render(ThemeManager.s_preview_);
			return;
		}
		if (saved !== null)
			ThemeManager.s_current_ = saved;
		ThemeManager.s_preview_ = null;
		ThemeManager.Render(ThemeManager.s_current_);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마 1개를 화면에 그린다. 미리보기·확정 공용.
	// @param _theme: 테마
	private static Render(_theme: ITheme): void
	{
		if (ThemeManager.s_style_ === null)
			return;
		const mode = Settings.Get<ThemeMode>("Theme.Scheme", "System");
		const wantDark = mode === "Dark" || (mode === "System" && (ThemeManager.s_media_?.matches ?? true));
		const scheme: ThemeScheme = wantDark ? "Dark" : "Light";
		const fallback = ThemeManager.s_themes_.get("oc-2");
		const fallbackResolved = fallback !== undefined ? ThemeResolver.Resolve(fallback, "Dark", null) : null;
		const useScheme = (scheme === "Light" && !_theme.HasLight) ? "Dark" : (scheme === "Dark" && !_theme.HasDark ? "Light" : scheme);
		ThemeManager.s_resolved_ = ThemeResolver.Resolve(_theme, useScheme, fallbackResolved);
		const typo: ITypography = {
			FontSize: Settings.Get<number>("Theme.FontSize", 13),
			FontFamily: Settings.Get<string>("Theme.FontFamily", "Segoe UI, system-ui, sans-serif"),
			MonoFamily: Settings.Get<string>("Theme.MonoFamily", "Cascadia Code, Consolas, monospace"),
		};
		const css = ThemeCss.Build(ThemeManager.s_resolved_, typo, Settings.Get<DensityKind>("Theme.Density", "Normal"));
		MonacoLoader.ApplyFontSize(typo.FontSize);
		if (css !== ThemeManager.s_style_.textContent)
		{
			ThemeManager.s_style_.textContent = css;
			document.documentElement.dataset["theme"] = _theme.Id;
			document.documentElement.dataset["scheme"] = useScheme.toLowerCase();
			MonacoLoader.ApplyTheme(ThemeManager.s_resolved_.Tokens, useScheme === "Dark");
			ThemeManager.s_changed_.Invoke({ Id: _theme.Id, Name: _theme.Name, Scheme: useScheme });
			EventBus.Publish("Scouter.ThemeChanged", { Id: _theme.Id, Scheme: useScheme });
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Bundled desktop themes (seeds/palette) registration. Invalid entries are skipped.
	private static LoadBundledDesktop(): void
	{
		for (const entry of kDesktopThemes)
		{
			try
			{
				ThemeManager.s_themes_.set(entry.Id, ThemeLoader.ParseDesktop(entry.Id, entry.Json, "BuiltIn"));
			}
			catch
			{
				continue;
			}
		}
		const current = Settings.Get<string>("Theme.Id", "oc-2");
		const found = ThemeManager.s_themes_.get(current);
		if (found !== undefined)
			ThemeManager.s_current_ = found;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용자 테마 파일 1개를 다시 읽는다.
	// @param _file: 경로
	private static async ReloadFile(_file: string): Promise<void>
	{
		if (!_file.endsWith(".json"))
			return;
		try
		{
			const json: unknown = JSON.parse(await fs.readFile(_file, "utf-8"));
			const id = path.basename(_file, ".json");
			ThemeManager.s_themes_.set(id, ThemeLoader.ParseFile(id, json, "User"));
			if (ThemeManager.s_current_?.Id === id)
				ThemeManager.Apply();
		}
		catch
		{
			// 파싱 실패는 이전 버전 유지.
		}
	}
}
