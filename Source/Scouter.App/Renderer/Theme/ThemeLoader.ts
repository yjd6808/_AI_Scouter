/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeLoader. 내장 + 폴더 테마를 읽고 검증한다.
*/

import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { ITheme, IThemeJson, ThemeSource } from "@scouter/gui";

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
				const json = JSON.parse(await fs.readFile(path.join(_dir, file), "utf-8")) as IThemeJson;
				out.push(ThemeLoader.Parse(file.slice(0, -".json".length), json, _source));
			}
			catch
			{
				continue;
			}
		}
		return out;
	}
}
