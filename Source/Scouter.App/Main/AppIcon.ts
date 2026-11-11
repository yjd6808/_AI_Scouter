/*
	작성자: 윤정도
	생성일: 2026-10-19
	=====
	설명: 앱 아이콘 경로. Res/Icon/Scouter.ico를 패키지·개발 실행 모두에서 찾는다.
*/

import { app } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

export class AppIcon
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 아이콘(.ico) 경로를 구한다. 없으면 null.
	public static Path(): string | null
	{
		const dirs = [path.join(process.resourcesPath, "Res", "Icon"), path.join(app.getAppPath(), "Res", "Icon")];
		for (const dir of dirs)
		{
			const full = path.join(dir, "Scouter.ico");
			try
			{
				if (fs.existsSync(full))
					return full;
			}
			catch
			{
				// 다음 후보.
			}
		}
		return null;
	}
}
