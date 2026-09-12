/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SettingsSource. set 접두어. 카탈로그 평탄화.
*/

import type { IJsonSchemaNode } from "@scouter/gui";
import { Settings } from "../../../Services/Settings";
import { SettingsCatalog } from "../../ScouterCore/SettingsCatalog";
import { Fuzzy } from "../Fuzzy";
import type { IItemSource, IPaletteItem, ISettingsPaletteItem } from "./ItemSource";

const kMaxItems = 50;

export class SettingsSource implements IItemSource
{
	// ==================== 멤버 ====================
	public readonly Prefix = "set ";

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 키 fuzzy 상위 50개. 실행은 창이 인라인 에디터로 이어간다.
	// @param _text: 접두어 제거 쿼리
	public Query(_text: string): IPaletteItem[]
	{
		const query = _text.toLowerCase();
		const out: ISettingsPaletteItem[] = [];
		for (const category of SettingsCatalog.Categories())
		{
			const props = category.Schema.properties ?? {};
			for (const [key, node] of Object.entries(props))
				this.Collect(`${category.Id}.${key}`, node, query, out);
		}
		const collator = new Intl.Collator("ko");
		out.sort((_a, _b) => (_b.Score - _a.Score) || collator.compare(_a.Title, _b.Title));
		return out.slice(0, kMaxItems);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 중첩 객체를 점 표기로 푼다. 리프만 항목으로 만든다.
	// @param _path: 설정 키
	// @param _node: 스키마 노드
	// @param _query: 소문자 쿼리
	// @param _out: 수집 버퍼
	private Collect(_path: string, _node: IJsonSchemaNode, _query: string, _out: ISettingsPaletteItem[]): void
	{
		const props = _node.properties;
		if (props !== undefined)
		{
			for (const [key, child] of Object.entries(props))
				this.Collect(`${_path}.${key}`, child, _query, _out);
			return;
		}
		const score = Fuzzy.Score(_query, _path);
		if (score === null)
			return;
		const current = Settings.Has(_path) ? Settings.Get<unknown>(_path) : _node.default;
		_out.push({
			Kind: "Settings",
			Title: _path,
			Subtitle: `${_node.type ?? "string"} · 현재 ${SettingsSource.TextOf(current)}`,
			Hotkey: "set",
			Score: score,
			Key: _path,
			Run: () => undefined,
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 한 줄 문자열로 굳힌다.
	// @param _value: 값
	private static TextOf(_value: unknown): string
	{
		if (typeof _value === "string")
			return _value;
		if (typeof _value === "number" || typeof _value === "boolean")
			return String(_value);
		return JSON.stringify(_value ?? "");
	}
}
