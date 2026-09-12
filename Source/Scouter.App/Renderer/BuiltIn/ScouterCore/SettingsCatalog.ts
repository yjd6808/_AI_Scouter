/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SettingsCatalog. App 스키마 + Plugin 스키마를 카테고리로 묶는다.
*/

import type { IJsonSchemaNode } from "@scouter/gui";
import schemaJson from "../../../Config/Settings.schema.json" with { type: "json" };

export interface ISettingsCategory
{
	Id: string;
	Title: string;
	Schema: IJsonSchemaNode;
}

export class SettingsCatalog
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 카테고리 목록을 만든다. x-category 그룹 + Plugin별 1개.
	public static Categories(): ISettingsCategory[]
	{
		const schema = schemaJson as unknown as { properties: Record<string, { properties?: Record<string, IJsonSchemaNode>; title?: string }> };
		const out: ISettingsCategory[] = [];
		for (const [group, node] of Object.entries(schema.properties))
		{
			out.push({
				Id: group,
				Title: SettingsCatalog.TitleOf(group),
				Schema: { type: "object", properties: node.properties ?? {} },
			});
		}
		return out;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 표시 이름.
	// @param _id: 그룹 Id
	private static TitleOf(_id: string): string
	{
		switch (_id)
		{
			case "Ui": return "일반";
			case "Theme": return "테마 · 글꼴";
			case "Mcp": return "연결 (MCP)";
			case "App": return "앱";
			case "Log": return "로그";
			default: return _id;
		}
	}
}
