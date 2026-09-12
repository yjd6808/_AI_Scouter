/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Read Tool. 노트 전문 읽기.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { NoteStore } from "../NoteStore";

export class ReadTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Read";
	public readonly Description = "노트 전문을 읽는다.";
	public readonly InputSchema = {
		type: "object",
		properties: { Note: { type: "string" } },
		required: ["Note"],
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
	// 전문을 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const note = _args["Note"];
		if (typeof note !== "string" || note.length === 0)
			throw new Error("Note required");
		return { Note: note, Text: await this.store_.ReadAsync(note) };
	}
}
