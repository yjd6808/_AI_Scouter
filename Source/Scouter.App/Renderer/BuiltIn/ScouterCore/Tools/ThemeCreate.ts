/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeCreate Tool. 파생 테마 생성.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";
import type { ITool } from "@scouter/plugin-api";
import { ThemeManager } from "../../../Theme/ThemeManager";
import { ThemeLoader } from "../../../Theme/ThemeLoader";
import { ThemeLint } from "@scouter/gui";
import { Paths } from "../../../Services/Paths";

export class ThemeCreateTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ThemeCreate";
	public readonly Description = "베이스 복사 + 오버라이드로 파생 테마를 만든다.";
	public readonly InputSchema = { type: "object", properties: { Name: { type: "string" }, Base: { type: "string" }, Overrides: { type: "object" } }, required: ["Name", "Base"] };
	public readonly DefaultApproval = "ask" as const;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파생 JSON을 사용자 폴더에 쓴다.
	// @param _args: 인자
	public async Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const name = _args["Name"];
		const base = _args["Base"];
		if (typeof name !== "string" || typeof base !== "string")
			throw new Error("Name/Base required");
		if (!/^[a-z0-9-]+$/.test(name))
			throw new Error("Name은 소문자·숫자·- 만");
		const raw = ThemeManager.RawOf(base);
		if (raw === null)
			throw new Error(`unknown base: ${base}`);
		const overrides = (_args["Overrides"] ?? {}) as Record<string, { dark?: string; light?: string }>;
		const theme = JSON.parse(JSON.stringify(raw.theme)) as Record<string, { dark?: string; light?: string }>;
		for (const [token, pair] of Object.entries(overrides))
			theme[token] = pair;
		const json = { $schema: "scouter://core/theme.schema.json", name, defs: raw.defs, theme };
		const parsed = ThemeLoader.Parse(name, json, "User");
		const lint = ThemeLint.Run(parsed);
		const dir = path.join(Paths.ScouterHome, "themes");
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, `${name}.json`), JSON.stringify(json, null, 2), "utf-8");
		ThemeManager.Register(parsed);
		return { Id: name, Warnings: lint.Warnings };
	}
}
