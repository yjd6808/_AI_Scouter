/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Append Tool. 노트 끝에 항목 추가.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { NoteStore } from "../NoteStore";

export class AppendTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Append";
	public readonly Description = "노트 끝에 타임스탬프 항목을 추가한다. 없으면 만든다.";
	public readonly InputSchema = {
		type: "object",
		properties: { Note: { type: "string" }, Text: { type: "string" } },
		required: ["Text"],
	};
	public readonly DefaultApproval = "auto" as const;
	private readonly store_: NoteStore;
	private readonly fallback_: () => string;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소와 기본 노트 제공자로 만든다.
	// @param _store: 저장소
	// @param _fallback: Note 생략 시 기본값 제공자
	public constructor(_store: NoteStore, _fallback: () => string)
	{
		this.store_ = _store;
		this.fallback_ = _fallback;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 덧붙인다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const text = _args["Text"];
		if (typeof text !== "string" || text.trim().length === 0)
			throw new Error("Text required");
		const raw = _args["Note"];
		const note = typeof raw === "string" && raw.length > 0 ? raw : this.fallback_();
		await this.store_.AppendAsync(note, text.trim());
		return { Ok: true, Note: note };
	}
}
