/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ChangeFiles Tool. 단일 체인지 파일.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { IP4Runner } from "../Types";

export class ChangeFilesTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ChangeFiles";
	public readonly Description = "단일 체인지 파일 목록.";
	public readonly InputSchema = { type: "object", properties: { Change: { type: "number" } }, required: ["Change"] };
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
	// 체인지 1건의 파일을 반환한다.
	// @param _args: 인자
	// @param _call: 진행·취소
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const change = _args["Change"];
		if (typeof change !== "number")
			throw new Error("Change required");
		const described = await this.runner_.Describe([Math.floor(change)], _call.Signal);
		return described[0] ?? { Change: change, Files: [] };
	}
}
