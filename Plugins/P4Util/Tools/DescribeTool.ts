/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Describe Tool. 체인지 구조화 설명.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { IP4Runner } from "../Types";

export class DescribeTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Describe";
	public readonly Description = "체인지 설명/파일/작성자.";
	public readonly InputSchema = { type: "object", properties: { Changes: { type: "array", items: { type: "number" } } }, required: ["Changes"] };
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
	// 체인지 상세를 반환한다.
	// @param _args: 인자
	// @param _call: 진행·취소
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const raw = _args["Changes"];
		if (!Array.isArray(raw))
			throw new Error("Changes required");
		const changes = raw.filter((_c): _c is number => typeof _c === "number");
		return this.runner_.Describe(changes, _call.Signal);
	}
}
