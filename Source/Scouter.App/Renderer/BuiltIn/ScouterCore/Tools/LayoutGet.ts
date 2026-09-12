/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: LayoutGet Tool. 이름으로 XML 원문 + 해석 경로.
*/

import type { ITool } from "@scouter/plugin-api";
import { UIManager } from "@scouter/gui";

export class LayoutGetTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "LayoutGet";
	public readonly Description = "레이아웃 XML 원문과 해석된 경로.";
	public readonly InputSchema = { type: "object", properties: { Name: { type: "string" } }, required: ["Name"] };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// provider 경유로 읽는다.
	// @param _args: 인자
	public async Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const name = _args["Name"];
		if (typeof name !== "string" || name.includes(".."))
			throw new Error("Name 범위 밖");
		const provider = UIManager.LayoutProvider;
		if (provider === null)
			throw new Error("layout provider 없음");
		const xml = await provider.Resolve(name);
		if (xml === null)
			throw new Error(`unknown layout: ${name}`);
		return { Name: name, Path: provider.PathOf(name), Xml: xml };
	}
}
