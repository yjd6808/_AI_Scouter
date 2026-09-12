/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: LayoutSet Tool. lint 통과 시 사용자 폴더 저장 + 리로드.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";
import type { ITool } from "@scouter/plugin-api";
import { UIManager } from "@scouter/gui";
import { EventBus } from "../../../Services/EventBus";
import { Paths } from "../../../Services/Paths";
import { CheckXml } from "./LayoutLint";

export class LayoutSetTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "LayoutSet";
	public readonly Description = "레이아웃 XML을 저장하고 리로드한다.";
	public readonly InputSchema = { type: "object", properties: { Name: { type: "string" }, Xml: { type: "string" } }, required: ["Name", "Xml"] };
	public readonly DefaultApproval = "ask" as const;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 에러 있으면 저장 안 함. 통과 시 ~/.scouter/layouts에 쓴다.
	// @param _args: 인자
	public async Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const name = _args["Name"];
		const xml = _args["Xml"];
		if (typeof name !== "string" || !/^[\w-]+$/.test(name))
			throw new Error("Name 범위 밖");
		if (typeof xml !== "string")
			throw new Error("Xml required");
		const checked = CheckXml(xml);
		if (checked.Errors.length > 0)
			return { Ok: false, Errors: checked.Errors, Warnings: checked.Warnings };
		const file = path.join(Paths.ScouterHome, "layouts", `${name}.xml`);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, xml, "utf-8");
		EventBus.Publish("Scouter.LayoutReloaded", { Name: name });
		const reloaded = await UIManager.ReloadByLayout(name);
		return { Ok: true, Warnings: checked.Warnings, Reloaded: reloaded };
	}
}
