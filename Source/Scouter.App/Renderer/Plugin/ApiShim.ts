/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ApiShim. 번들 require를 CJS shim 파일로 연결한다. 네임스페이스 통째로.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";

const kSpecs = ["@scouter/gui", "@scouter/plugin-api"];
const kFiles = new Map<string, string>();

export class ApiShim
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 네임스페이스를 전역에 등록한다. Bootstrap 1회.
	// @param _modules: spec → 네임스페이스
	public static Register(_modules: Record<string, Record<string, unknown>>): void
	{
		(globalThis as Record<string, unknown>)["__scouter_modules__"] = _modules;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// shim 파일을 쓴다. Register 다음에 1회.
	// @param _dir: 출력 폴더
	public static async InitAsync(_dir: string): Promise<void>
	{
		await fs.mkdir(_dir, { recursive: true });
		for (const spec of kSpecs)
		{
			const file = path.join(_dir, `${spec.replace(/[^a-z]+/g, "-")}.cjs`);
			await fs.writeFile(file, `module.exports = globalThis["__scouter_modules__"][${JSON.stringify(spec)}];\n`, "utf-8");
			kFiles.set(spec, file);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 번들 텍스트의 require를 shim 파일로 바꾼다.
	// @param _code: 번들 원문
	public static Rewrite(_code: string): string
	{
		let out = _code;
		for (const spec of kSpecs)
		{
			const file = kFiles.get(spec);
			if (file === undefined)
				continue;
			const escaped = JSON.stringify(file).slice(1, -1);
			out = out.split(`require("${spec}")`).join(`require("${escaped}")`);
			out = out.split(`require('${spec}')`).join(`require('${escaped}')`);
		}
		return out;
	}
}
