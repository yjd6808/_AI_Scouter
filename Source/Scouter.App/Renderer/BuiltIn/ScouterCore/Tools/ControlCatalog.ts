/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ControlCatalog Tool. 태그별 속성 표.
*/

import type { ITool } from "@scouter/plugin-api";
import { ElementCatalog } from "@scouter/gui";

//////////////////////////////////////////////////////////////////////////////////////
// 기본값을 문자열로 안전 변환한다.
// @param _value: 기본값
function SafeDefault(_value: unknown): string
{
	if (typeof _value === "string" || typeof _value === "number" || typeof _value === "boolean")
		return String(_value);
	if (_value === null || _value === undefined)
		return "?";
	const json: unknown = JSON.stringify(_value);
	return typeof json === "string" ? json : "?";
}

export class ControlCatalogTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ControlCatalog";
	public readonly Description = "컨트롤 태그의 속성/기본값 표.";
	public readonly InputSchema = { type: "object", properties: { Tag: { type: "string" } } };
	public readonly Annotations = { ReadOnly: true };

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tag 없으면 태그 목록, 있으면 속성 표.
	// @param _args: 인자
	public Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const tag = _args["Tag"];
		if (typeof tag !== "string" || tag.length === 0)
			return Promise.resolve({ Tags: ElementCatalog.Names() });
		const props = ElementCatalog.PropertiesOf(tag);
		if (props.length === 0 && !ElementCatalog.Has(tag))
			return Promise.reject(new Error(`unknown tag: ${tag}`));
		return Promise.resolve({
			Tag: tag,
			Properties: props.map((_p) => ({
				Name: _p.Name,
				Default: SafeDefault(_p.Meta.Default),
				Owner: typeof _p.Owner === "function" ? (_p.Owner as { name: string }).name : "?",
			})),
		});
	}
}
