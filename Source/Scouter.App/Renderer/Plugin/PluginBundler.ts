/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginBundler. esbuild 온더플라이 번들 + 해시 캐시.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import type { IPluginManifest } from "@scouter/plugin-api";

export class PluginBundler
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Index.ts를 .cache/Index.cjs로 묶는다. CJS+node (require 로드용). 소스 해시 같으면 캐시.
	// @param _dir: Plugin 폴더
	// @param _manifest: 매니페스트
	public static async BuildAsync(_dir: string, _manifest: IPluginManifest): Promise<string>
	{
		const entry = path.join(_dir, _manifest.Main);
		const cacheDir = path.join(_dir, ".cache");
		const outFile = path.join(cacheDir, "Index.cjs");
		const hashFile = path.join(cacheDir, "hash.txt");
		const hash = await PluginBundler.HashDir(_dir);
		try
		{
			const prev = await fs.readFile(hashFile, "utf-8");
			if (prev === hash)
			{
				await fs.access(outFile);
				return outFile;
			}
		}
		catch
		{
			// 캐시 미스. 빌드 진행.
		}
		await fs.mkdir(cacheDir, { recursive: true });
		await build({
			entryPoints: [entry],
			outfile: outFile,
			bundle: true,
			format: "cjs",
			platform: "node",
			target: "es2022",
			sourcemap: "inline",
			external: ["@scouter/gui", "@scouter/plugin-api", "electron"],
			logLevel: "silent",
		});
		await fs.writeFile(hashFile, hash, "utf-8");
		return outFile;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// .cache 제외 전 소스 해시.
	// @param _dir: Plugin 폴더
	private static async HashDir(_dir: string): Promise<string>
	{
		const hash = createHash("sha256");
		const files = await PluginBundler.Collect(_dir);
		files.sort();
		for (const file of files)
		{
			hash.update(file);
			hash.update(await fs.readFile(path.join(_dir, file)));
		}
		return hash.digest("hex");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// .ts/.json/.css 목록 수집. .cache 제외.
	// @param _dir: Plugin 폴더
	private static async Collect(_dir: string): Promise<string[]>
	{
		const out: string[] = [];
		const walk = async (_rel: string): Promise<void> =>
		{
			const full = path.join(_dir, _rel);
			let entries: string[] = [];
			try
			{
				entries = await fs.readdir(full);
			}
			catch
			{
				return;
			}
			for (const name of entries)
			{
				if (name === ".cache" || name === "node_modules")
					continue;
				const rel = _rel.length > 0 ? `${_rel}/${name}` : name;
				const stat = await fs.stat(path.join(_dir, rel));
				if (stat.isDirectory())
					await walk(rel);
				else if (name.endsWith(".ts") || name.endsWith(".json") || name.endsWith(".css") || name.endsWith(".xml"))
					out.push(rel);
			}
		};
		await walk("");
		return out;
	}
}
