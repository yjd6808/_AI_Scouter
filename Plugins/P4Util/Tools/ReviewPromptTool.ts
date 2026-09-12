/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ReviewPrompt Tool. 리뷰 컨텍스트 마크다운.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { IP4Runner, IDescribeInfo } from "../Types";

const kMaxFiles = 5;
const kMaxDiffChars = 4000;

//////////////////////////////////////////////////////////////////////////////////////
// 체인지 1건을 마크다운으로 요약한다.
// @param _info: 상세
function Summarize(_info: IDescribeInfo): string
{
	const head = [`## Change ${_info.Change} by ${_info.User}`, "", _info.Description, "", `Files: ${_info.Files.length}`];
	for (const file of _info.Files.slice(0, kMaxFiles))
		head.push(`- ${file.Action} ${file.DepotPath}#${file.Rev}`);
	if (_info.Files.length > kMaxFiles)
		head.push(`- ... 외 ${_info.Files.length - kMaxFiles}개`);
	return head.join("\n");
}

export class ReviewPromptTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "ReviewPrompt";
	public readonly Description = "리뷰용 컨텍스트 마크다운.";
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
	// describe + 대표 diff를 묶는다.
	// @param _args: 인자
	// @param _call: 진행·취소
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const change = _args["Change"];
		if (typeof change !== "number")
			throw new Error("Change required");
		const described = await this.runner_.Describe([Math.floor(change)], _call.Signal);
		const info = described[0];
		if (info === undefined)
			throw new Error(`unknown change: ${String(change)}`);
		const parts = [Summarize(info), "", "## Diffs"];
		for (const file of info.Files.slice(0, kMaxFiles))
		{
			_call.Signal.throwIfAborted();
			try
			{
				const diff = await this.runner_.Diff2(file.DepotPath, Math.max(1, file.Rev - 1), file.Rev, _call.Signal);
				const cut = diff.length > kMaxDiffChars ? `${diff.slice(0, kMaxDiffChars)}\n...(잘림)` : diff;
				parts.push("", `### ${file.DepotPath}`, "```diff", cut, "```");
			}
			catch
			{
				parts.push("", `### ${file.DepotPath}`, "(diff 실패)");
			}
		}
		return parts.join("\n");
	}
}
