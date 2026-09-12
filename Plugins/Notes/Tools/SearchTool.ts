/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Search Tool. 전 노트 본문 검색.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { NoteStore } from "../NoteStore";

export class SearchTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Search";
	public readonly Description = "전 노트에서 본문을 찾는다.";
	public readonly InputSchema = {
		type: "object",
		properties: { Query: { type: "string" } },
		required: ["Query"],
	};
	public readonly Annotations = { ReadOnly: true };
	private readonly store_: NoteStore;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소로 만든다.
	// @param _store: 저장소
	public constructor(_store: NoteStore)
	{
		this.store_ = _store;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 일치 줄을 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const query = _args["Query"];
		if (typeof query !== "string" || query.length === 0)
			throw new Error("Query required");
		return { Matches: await this.store_.SearchAsync(query) };
	}
}
