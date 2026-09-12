/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: List Tool. 노트 목록.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { NoteStore } from "../NoteStore";

export class ListTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "List";
	public readonly Description = "노트 목록을 이름순으로 돌려준다.";
	public readonly InputSchema = { type: "object", properties: {} };
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
	// 목록을 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		return { Notes: await this.store_.ListAsync() };
	}
}
