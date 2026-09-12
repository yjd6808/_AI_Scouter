/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ConnectSnippets. {{Url}} {{Token}} 치환 + 사용자 파일 우선.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";
import bundledJson from "../../../Config/ConnectSnippets.json" with { type: "json" };
import { Paths } from "../../Services/Paths";

const kBundled: Record<string, string> = bundledJson;
const kUserFile = "connect-snippets.json";

export class ConnectSnippets
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 클라이언트 목록을 반환한다. 사용자 파일이 번들을 덮어쓴다.
	public static async Clients(): Promise<string[]>
	{
		const merged = await ConnectSnippets.LoadMerged();
		return Object.keys(merged);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스니펫을 렌더한다.
	// @param _client: 클라이언트 이름
	// @param _url: http://127.0.0.1:port
	// @param _token: 토큰
	public static async Render(_client: string, _url: string, _token: string): Promise<string>
	{
		const merged = await ConnectSnippets.LoadMerged();
		const template = merged[_client];
		if (template === undefined)
			throw new Error(`[Connect] 알 수 없는 클라이언트: ${_client}`);
		return template.split("{{Url}}").join(_url).split("{{Token}}").join(_token);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 번들 + 사용자 파일을 합친다.
	private static async LoadMerged(): Promise<Record<string, string>>
	{
		const merged: Record<string, string> = { ...kBundled };
		try
		{
			const raw = JSON.parse(await fs.readFile(path.join(Paths.ScouterHome, kUserFile), "utf-8")) as unknown;
			if (typeof raw === "object" && raw !== null)
			{
				for (const [key, value] of Object.entries(raw as Record<string, unknown>))
				{
					if (typeof value === "string")
						merged[key] = value;
				}
			}
		}
		catch
		{
			// 사용자 파일 없으면 번들만.
		}
		return merged;
	}
}
