/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: OpenedSummary Tool. 열린 파일 요약.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { IP4Runner } from "../Types";

export class OpenedSummaryTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "OpenedSummary";
	public readonly Description = "열린 파일 요약(체인지별 묶음).";
	public readonly InputSchema = { type: "object", properties: { Client: { type: "string" } } };
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
	// 체인지별 파일 수와 목록을 반환한다.
	// @param _args: 인자
	// @param _call: 진행·취소
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const client = _args["Client"];
		const opened = await this.runner_.Opened(typeof client === "string" ? client : "", _call.Signal);
		const byChange = new Map<number, string[]>();
		for (const file of opened)
		{
			const list = byChange.get(file.Change) ?? [];
			list.push(`${file.Action} ${file.DepotPath}`);
			byChange.set(file.Change, list);
		}
		return {
			Count: opened.length,
			Groups: [...byChange.entries()].map(([_change, _files]) => ({ Change: _change, Count: _files.length, Files: _files })),
		};
	}
}
