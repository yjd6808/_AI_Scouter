/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeList Tool. 테마 목록.
*/

import type { ITool } from "@scouter/plugin-api";
import { ThemeManager } from "../../../Theme/ThemeManager";

export class ThemeListTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ThemeList";
	public readonly Description = "테마 목록.";
	public readonly InputSchema = { type: "object", properties: {} };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록을 반환한다.
	public Run(): Promise<unknown>
	{
		return Promise.resolve(ThemeManager.List());
	}
}
