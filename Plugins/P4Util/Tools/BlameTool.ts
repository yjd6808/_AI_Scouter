/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Blame Tool. 라인 책임자.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { IP4Runner } from "../Types";

export class BlameTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Blame";
	public readonly Description = "파일 라인별 체인지.";
	public readonly InputSchema = { type: "object", properties: { Path: { type: "string" }, Line: { type: "number" } }, required: ["Path"] };
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
	// 전체 또는 지정 줄의 책임을 반환한다.
	// @param _args: 인자
	// @param _call: 진행·취소
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const path = _args["Path"];
		if (typeof path !== "string" || path.length === 0)
			throw new Error("Path required");
		const lines = await this.runner_.Annotate(path, _call.Signal);
		const line = _args["Line"];
		if (typeof line === "number")
			return lines.find((_l) => _l.Line === Math.floor(line)) ?? null;
		return lines;
	}
}
