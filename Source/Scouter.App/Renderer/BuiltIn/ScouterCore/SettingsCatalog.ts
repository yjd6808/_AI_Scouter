/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SettingsCatalog. App 스키마 + Plugin 스키마를 카테고리로 묶는다.
*/

import type { IJsonSchemaNode } from "@scouter/gui";
import schemaJson from "../../../Config/Settings.schema.json" with { type: "json" };
import { ThemeManager } from "../../Theme/ThemeManager";

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
				Schema: { type: "object", properties: SettingsCatalog.PropsOf(group, node.properties) },
			});
		}
		return out;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 속성을 복사한다. 테마 Id에는 후보 목록을 enum으로 단다.
	// @param _group: 그룹 Id
	// @param _props: 원본 속성
	private static PropsOf(_group: string, _props?: Record<string, IJsonSchemaNode>): Record<string, IJsonSchemaNode>
	{
		const cloned: Record<string, IJsonSchemaNode> = {};
		for (const [key, node] of Object.entries(_props ?? {}))
			cloned[key] = { ...node };
		if (_group === "Theme" && cloned["Id"] !== undefined)
		{
			const ids = ThemeManager.List().map((_t) => _t.Id);
			if (ids.length > 0)
				cloned["Id"] = { ...cloned["Id"], enum: ids };
		}
		return cloned;
	}

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
