/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: DiffRange Tool. 리비전 범위 diff.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { IP4Runner } from "../Types";

export class DiffRangeTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "DiffRange";
	public readonly Description = "리비전 범위 diff 텍스트.";
	public readonly InputSchema = {
		type: "object",
		properties: { Path: { type: "string" }, From: { type: "number" }, To: { type: "number" } },
		required: ["Path", "From", "To"],
	};
	public readonly Annotations = { ReadOnly: true };

	private readonly runner_: IP4Runner;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 러너로 만든다.
	// @param _runner: 러너
	public constructor(_runner: IP4Runner)
	{
		this.runner_ = _runner;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// diff2 결과를 반환한다.
	// @param _args: 인자
	// @param _call: 진행·취소
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const path = _args["Path"];
		const from = _args["From"];
		const to = _args["To"];
		if (typeof path !== "string" || path.length === 0)
			throw new Error("Path required");
		if (typeof from !== "number" || typeof to !== "number")
			throw new Error("From/To required");
		return this.runner_.Diff2(path, Math.floor(from), Math.floor(to), _call.Signal);
	}
}
