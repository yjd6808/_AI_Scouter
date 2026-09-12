/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: LayoutLint Tool. XML 검사 + 공유 검사 함수.
*/

import type { ITool } from "@scouter/plugin-api";
import { LayoutLint } from "@scouter/gui";
import type { ILintMessage } from "@scouter/gui";
import { UIManager } from "@scouter/gui";

export interface ILayoutCheck
{
	Errors: ILintMessage[];
	Warnings: ILintMessage[];
}

//////////////////////////////////////////////////////////////////////////////////////
// XML 1건을 검사한다. E 시작은 에러, W 시작은 경고.
// @param _xml: XML 원문
export function CheckXml(_xml: string): ILayoutCheck
{
	const messages = LayoutLint.LintXml(_xml, UIManager.CreateContext());
	return {
		Errors: messages.filter((_m) => _m.Code.startsWith("E")),
		Warnings: messages.filter((_m) => !_m.Code.startsWith("E")),
	};
}

export class LayoutLintTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "LayoutLint";
	public readonly Description = "레이아웃 XML을 검사한다.";
	public readonly InputSchema = { type: "object", properties: { Xml: { type: "string" } }, required: ["Xml"] };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 에러·경고를 나눠 반환한다.
	// @param _args: 인자
	public Run(_args: Record<string, unknown>): Promise<unknown>
	{
		if (typeof _args["Xml"] !== "string")
			return Promise.reject(new Error("Xml required"));
		return Promise.resolve(CheckXml(_args["Xml"]));
	}
}
