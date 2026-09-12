/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginDiscovery. 폴더 스캔. BuiltIn → 사용자 → --plugin-dir.
*/

import { promises as fs } from "node:fs";
import * as path from "node:path";

export interface IPluginCandidate
{
	Id: string;
	Dir: string;
	Source: "BuiltIn" | "User" | "External";
}

export class PluginDiscovery
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 폴더들을 순서대로 스캔한다. Id 중복이면 나중 것 우선.
	// @param _dirs: [BuiltIn, User, External] 폴더 (없으면 건너뜀)
	public static async Scan(_dirs: Array<{ Dir: string | null; Source: "BuiltIn" | "User" | "External" }>): Promise<IPluginCandidate[]>
	{
		const byId = new Map<string, IPluginCandidate>();
		for (const entry of _dirs)
		{
			if (entry.Dir === null)
				continue;
			let names: string[] = [];
			try
			{
				names = await fs.readdir(entry.Dir);
			}
			catch
			{
				continue;
			}
			for (const name of names)
			{
				const dir = path.join(entry.Dir, name);
				try
				{
					const stat = await fs.stat(dir);
					if (!stat.isDirectory())
						continue;
					await fs.access(path.join(dir, "Plugin.json"));
				}
				catch
				{
					continue;
				}
				byId.set(name, { Id: name, Dir: dir, Source: entry.Source });
			}
		}
		return [...byId.values()];
	}
}
