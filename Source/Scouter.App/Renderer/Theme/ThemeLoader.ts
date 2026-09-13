/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeLoader. 내장 + 폴더 테마를 읽고 검증한다. 구·신 포맷 공존.
*/

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { DesktopResolver } from "@scouter/gui";
import type { IDesktopThemeJson, IDesktopVariant, IRawDesktopThemeJson, ITheme, IThemeJson, IThemePaletteColors, IThemeSeedColors, ThemeSource } from "@scouter/gui";

export class ThemeLoader
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// JSON을 테마로 푼다. 필수 필드 없으면 throw.
	// @param _id: Id (파일명)
	// @param _json: 파싱된 JSON
	// @param _source: 출처
	public static Parse(_id: string, _json: IThemeJson, _source: ThemeSource): ITheme
	{
		if (typeof _json.name !== "string" || typeof _json.defs !== "object" || typeof _json.theme !== "object")
			throw new Error(`[ThemeLoader] 형식 오류: ${_id}`);
		let hasLight = false;
		let hasDark = false;
		for (const pair of Object.values(_json.theme))
		{
			if (pair.light !== undefined)
				hasLight = true;
			if (pair.dark !== undefined)
				hasDark = true;
		}
		return { Id: _id, Name: _json.name, Source: _source, Defs: _json.defs, Tokens: _json.theme, HasLight: hasLight, HasDark: hasDark };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 데스크톱 포맷(seeds·palette) JSON을 테마로 푼다. 양 스킴을 미리 해석한다.
	// 소문자 디스크 원문과 파스칼 내부형을 같이 받는다.
	// @param _id: Id (파일명)
	// @param _json: 파싱된 JSON
	// @param _source: 출처
	public static ParseDesktop(_id: string, _json: IDesktopThemeJson | IRawDesktopThemeJson, _source: ThemeSource): ITheme
	{
		if (typeof _json.name !== "string" || typeof _json.light !== "object" || typeof _json.dark !== "object")
			throw new Error(`[ThemeLoader] 형식 오류: ${_id}`);
		const light = ThemeLoader.NormalizeVariant(_json.light);
		const dark = ThemeLoader.NormalizeVariant(_json.dark);
		ThemeLoader.CheckVariant(_id, light);
		ThemeLoader.CheckVariant(_id, dark);
		const id = typeof _json.id === "string" && _json.id.length > 0 ? _json.id : _id;
		return {
			Id: id,
			Name: _json.name,
			Source: _source,
			Defs: {},
			Tokens: {},
			HasLight: true,
			HasDark: true,
			Desktop: {
				Dark: DesktopResolver.Resolve(dark, true),
				Light: DesktopResolver.Resolve(light, false),
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 포맷을 가려 테마로 푼다. 구(defs·theme)·신(light·dark) 자동 판별.
	// @param _id: Id (파일명)
	// @param _json: 파싱된 JSON
	// @param _source: 출처
	public static ParseFile(_id: string, _json: unknown, _source: ThemeSource): ITheme
	{
		if (typeof _json !== "object" || _json === null)
			throw new Error(`[ThemeLoader] 형식 오류: ${_id}`);
		const record = _json as Record<string, unknown>;
		if (typeof record["light"] === "object" && typeof record["dark"] === "object")
			return ThemeLoader.ParseDesktop(_id, _json as IDesktopThemeJson | IRawDesktopThemeJson, _source);
		return ThemeLoader.Parse(_id, _json as IThemeJson, _source);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폴더의 *.json을 읽는다. 실패 파일은 건너뛴다.
	// @param _dir: 폴더
	// @param _source: 출처
	public static async LoadDirAsync(_dir: string, _source: ThemeSource): Promise<ITheme[]>
	{
		const out: ITheme[] = [];
		let files: string[] = [];
		try
		{
			files = await fs.readdir(_dir);
		}
		catch
		{
			return out;
		}
		for (const file of files)
		{
			if (!file.endsWith(".json"))
				continue;
			try
			{
				const json: unknown = JSON.parse(await fs.readFile(path.join(_dir, file), "utf-8"));
				out.push(ThemeLoader.ParseFile(file.slice(0, -".json".length), json, _source));
			}
			catch
			{
				continue;
			}
		}
		return out;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 변형 원문을 내부형으로 고친다. 소문자·파스칼 키를 같이 받는다. v2는 버린다.
	// @param _variant: 변형 원문
	private static NormalizeVariant(_variant: unknown): IDesktopVariant
	{
		if (typeof _variant !== "object" || _variant === null)
			return {};
		const record = _variant as Record<string, unknown>;
		const seeds = ThemeLoader.NormalizeSeeds(record["Seeds"] ?? record["seeds"]);
		const palette = ThemeLoader.NormalizePalette(record["Palette"] ?? record["palette"]);
		const overrides = record["Overrides"] ?? record["overrides"];
		const out: IDesktopVariant = {};
		if (seeds !== null)
			out.Seeds = seeds;
		if (palette !== null)
			out.Palette = palette;
		if (typeof overrides === "object" && overrides !== null)
			out.Overrides = overrides as Record<string, string>;
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 시드 원문을 내부형으로 고친다. 필수값 없음이면 null.
	// @param _raw: 시드 원문
	private static NormalizeSeeds(_raw: unknown): IThemeSeedColors | null
	{
		if (typeof _raw !== "object" || _raw === null)
			return null;
		const record = _raw as Record<string, unknown>;
		const pick = (_lower: string, _upper: string): string | undefined =>
		{
			const found = record[_lower] ?? record[_upper];
			return typeof found === "string" ? found : undefined;
		};
		const neutral = pick("neutral", "Neutral");
		const primary = pick("primary", "Primary");
		const success = pick("success", "Success");
		const warning = pick("warning", "Warning");
		const error = pick("error", "Error");
		const info = pick("info", "Info");
		const interactive = pick("interactive", "Interactive");
		if (neutral === undefined || primary === undefined || success === undefined || warning === undefined
			|| error === undefined || info === undefined || interactive === undefined)
			return null;
		const out: IThemeSeedColors = {
			Neutral: neutral, Primary: primary, Success: success, Warning: warning,
			Error: error, Info: info, Interactive: interactive,
		};
		const diffAdd = pick("diffAdd", "DiffAdd");
		if (diffAdd !== undefined)
			out.DiffAdd = diffAdd;
		const diffDelete = pick("diffDelete", "DiffDelete");
		if (diffDelete !== undefined)
			out.DiffDelete = diffDelete;
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 팔레트 원문을 내부형으로 고친다. 필수값 없음이면 null.
	// @param _raw: 팔레트 원문
	private static NormalizePalette(_raw: unknown): IThemePaletteColors | null
	{
		if (typeof _raw !== "object" || _raw === null)
			return null;
		const record = _raw as Record<string, unknown>;
		const pick = (_lower: string, _upper: string): string | undefined =>
		{
			const found = record[_lower] ?? record[_upper];
			return typeof found === "string" ? found : undefined;
		};
		const neutral = pick("neutral", "Neutral");
		const ink = pick("ink", "Ink");
		const primary = pick("primary", "Primary");
		const success = pick("success", "Success");
		const warning = pick("warning", "Warning");
		const error = pick("error", "Error");
		const info = pick("info", "Info");
		if (neutral === undefined || ink === undefined || primary === undefined || success === undefined
			|| warning === undefined || error === undefined || info === undefined)
			return null;
		const out: IThemePaletteColors = {
			Neutral: neutral, Ink: ink, Primary: primary, Success: success,
			Warning: warning, Error: error, Info: info,
		};
		const accent = pick("accent", "Accent");
		if (accent !== undefined)
			out.Accent = accent;
		const interactive = pick("interactive", "Interactive");
		if (interactive !== undefined)
			out.Interactive = interactive;
		const diffAdd = pick("diffAdd", "DiffAdd");
		if (diffAdd !== undefined)
			out.DiffAdd = diffAdd;
		const diffDelete = pick("diffDelete", "DiffDelete");
		if (diffDelete !== undefined)
			out.DiffDelete = diffDelete;
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 변형 1개의 모양을 굳힌다. palette·seeds 중 정확히 1개.
	// @param _id: Id
	// @param _variant: 변형
	private static CheckVariant(_id: string, _variant: IDesktopVariant): void
	{
		const hasPalette = _variant.Palette !== undefined;
		const hasSeeds = _variant.Seeds !== undefined;
		if (hasPalette === hasSeeds)
			throw new Error(`[ThemeLoader] 변형 오류: ${_id}`);
	}
}
