/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginScaffold Tool. 템플릿 복사.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";
import type { ITool } from "@scouter/plugin-api";
import { Paths } from "../../../Services/Paths";

const kFiles = ["Plugin.json", "Index.ts", "Views/MainControl.ts", "Layout/Main.xml"];

//////////////////////////////////////////////////////////////////////////////////////
// 템플릿 텍스트를 읽는다. 개발(Source) → 빌드(dist) 순.
// @param _name: 파일 이름
async function ReadTemplate(_name: string): Promise<string>
{
	const candidates = [
		path.resolve("Source/Scouter.App/Renderer/BuiltIn/ScouterCore/Templates/Plugin", _name),
		path.resolve("dist/renderer/Templates/Plugin", _name),
	];
	for (const full of candidates)
	{
		try
		{
			return await fs.readFile(full, "utf-8");
		}
		catch
		{
			continue;
		}
	}
	throw new Error(`템플릿 없음: ${_name}`);
}

export class PluginScaffoldTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "PluginScaffold";
	public readonly Description = "새 플러그인 뼈대를 만든다.";
	public readonly InputSchema = { type: "object", properties: { Id: { type: "string" }, Name: { type: "string" }, Dir: { type: "string" } }, required: ["Id", "Name"] };
	public readonly DefaultApproval = "ask" as const;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// {{Id}} {{Name}} 치환 후 파일 3개를 쓴다.
	// @param _args: 인자
	public async Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const id = _args["Id"];
		const name = _args["Name"];
		if (typeof id !== "string" || !/^[A-Za-z][\w-]*$/.test(id))
			throw new Error("Id 범위 밖");
		if (typeof name !== "string" || name.length === 0)
			throw new Error("Name required");
		const dir = _args["Dir"];
		const target = typeof dir === "string" && dir.length > 0 ? dir : path.join(Paths.ScouterHome, "plugins", id);
		if (target.includes(".."))
			throw new Error("Dir 범위 밖");
		const created: string[] = [];
		for (const file of kFiles)
		{
			const text = (await ReadTemplate(file)).split("{{Id}}").join(id).split("{{Name}}").join(name);
			const full = path.join(target, file);
			await fs.mkdir(path.dirname(full), { recursive: true });
			await fs.writeFile(full, text, "utf-8");
			created.push(full);
		}
		return { Dir: target, Created: created };
	}
}
