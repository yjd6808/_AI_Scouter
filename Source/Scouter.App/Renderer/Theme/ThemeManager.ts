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
import { Settings } from "../Services/Settings";
import { EventBus } from "../Services/EventBus";
import { ThemeLoader } from "./ThemeLoader";
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
	// 테마를 바꾼다. 없으면 false.
	// @param _id: Id
	public static Set(_id: string): boolean
	{
		const found = ThemeManager.s_themes_.get(_id);
		if (found === undefined)
			return false;
		ThemeManager.s_current_ = found;
		ThemeManager.Apply();
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
	// 지금 CSS를 다시 쓴다. 바뀌었을 때만 DOM 터치.
	public static Apply(): void
	{
		if (ThemeManager.s_current_ === null || ThemeManager.s_style_ === null)
			return;
		const mode = Settings.Get<ThemeMode>("Theme.Scheme", "System");
		const wantDark = mode === "Dark" || (mode === "System" && (ThemeManager.s_media_?.matches ?? true));
		const scheme: ThemeScheme = wantDark ? "Dark" : "Light";
		const fallback = ThemeManager.s_themes_.get("oc-2");
		const fallbackResolved = fallback !== undefined ? ThemeResolver.Resolve(fallback, "Dark", null) : null;
		const useScheme = (scheme === "Light" && !ThemeManager.s_current_.HasLight) ? "Dark" : (scheme === "Dark" && !ThemeManager.s_current_.HasDark ? "Light" : scheme);
		ThemeManager.s_resolved_ = ThemeResolver.Resolve(ThemeManager.s_current_, useScheme, fallbackResolved);
		const typo: ITypography = {
			FontSize: Settings.Get<number>("Theme.FontSize", 13),
			FontFamily: Settings.Get<string>("Theme.FontFamily", "Segoe UI, system-ui, sans-serif"),
			MonoFamily: Settings.Get<string>("Theme.MonoFamily", "Cascadia Code, Consolas, monospace"),
		};
		const css = ThemeCss.Build(ThemeManager.s_resolved_, typo, Settings.Get<DensityKind>("Theme.Density", "Normal"));
		if (css !== ThemeManager.s_style_.textContent)
		{
			ThemeManager.s_style_.textContent = css;
			document.documentElement.dataset["theme"] = ThemeManager.s_current_.Id;
			document.documentElement.dataset["scheme"] = useScheme.toLowerCase();
			ThemeManager.s_changed_.Invoke({ Id: ThemeManager.s_current_.Id, Name: ThemeManager.s_current_.Name, Scheme: useScheme });
			EventBus.Publish("Scouter.ThemeChanged", { Id: ThemeManager.s_current_.Id, Scheme: useScheme });
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용자 테마 파일 1개를 다시 읽는다.
	// @param _file: 경로
	private static async ReloadFile(_file: string): Promise<void>
	{
		if (!_file.endsWith(".json"))
			return;
		try
		{
			const json = JSON.parse(await fs.readFile(_file, "utf-8")) as IThemeJson;
			const id = path.basename(_file, ".json");
			ThemeManager.s_themes_.set(id, ThemeLoader.Parse(id, json, "User"));
			if (ThemeManager.s_current_?.Id === id)
				ThemeManager.Apply();
		}
		catch
		{
			// 파싱 실패는 이전 버전 유지.
		}
	}
}
