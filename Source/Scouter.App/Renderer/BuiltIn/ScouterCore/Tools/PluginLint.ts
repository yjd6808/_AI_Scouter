/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginLint Tool. Manifest + Layout 검사.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";
import type { ITool } from "@scouter/plugin-api";
import type { ILintMessage } from "@scouter/gui";
import { ManifestValidator } from "../../../Plugin/ManifestValidator";
import { CheckXml } from "./LayoutLint";

export class PluginLintTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "PluginLint";
	public readonly Description = "플러그인 폴더를 검사한다.";
	public readonly InputSchema = { type: "object", properties: { Dir: { type: "string" } }, required: ["Dir"] };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Manifest 검증 + Layout lint. tsc는 생략(빌드 시).
	// @param _args: 인자
	public async Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const dir = _args["Dir"];
		if (typeof dir !== "string" || dir.includes(".."))
			throw new Error("Dir 범위 밖");
		const errors: string[] = [];
		let layout = "Layout/Main.xml";
		try
		{
			const raw = JSON.parse(await fs.readFile(path.join(dir, "Plugin.json"), "utf-8")) as unknown;
			const manifest = ManifestValidator.Validate(raw);
			layout = manifest.Layout;
		}
		catch (_e)
		{
			errors.push(String(_e));
		}
		let xmlErrors: ILintMessage[] = [];
		let xmlWarnings: ILintMessage[] = [];
		try
		{
			const xml = await fs.readFile(path.join(dir, layout), "utf-8");
			const checked = CheckXml(xml);
			xmlErrors = checked.Errors;
			xmlWarnings = checked.Warnings;
		}
		catch (_e)
		{
			errors.push(String(_e));
		}
		return { Ok: errors.length === 0, Errors: errors, LayoutErrors: xmlErrors, LayoutWarnings: xmlWarnings };
	}
}
