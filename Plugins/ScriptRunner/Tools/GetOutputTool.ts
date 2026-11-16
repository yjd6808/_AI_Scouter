/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: GetOutput Tool. 스크립트의 마지막(또는 지금 실행 중인) 출력 끝부분과 실행 기록을 돌려준다.
	      읽기 전용이라 승인 없이 조회된다. 결과 64KB 잘림을 피하려고 글자 수 상한을 둔다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { RunnerEngine } from "../RunnerEngine";
import { ScriptFormat } from "../ScriptFormat";

const kDefaultChars = 16000;
const kMaxChars = 60000;

export class GetOutputTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "GetOutput";
	public readonly Description = "스크립트의 마지막 실행(실행 중이면 지금까지) 출력(stdout·stderr 합침) 끝부분과 실행 기록(Result·ExitCode·시각)을 돌려준다. MaxChars(기본 16000, 최대 60000)로 끝에서부터 자른다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Id: { type: "string", description: "항목 Id" },
			MaxChars: { type: "number", minimum: 100, maximum: kMaxChars, description: "돌려줄 출력 끝부분 글자 수" },
		},
		required: ["Id"],
	};
	// 로그 파일을 읽기만 한다.
	public readonly Annotations = { ReadOnly: true };
	private readonly engine_: RunnerEngine;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진을 주입받는다.
	// @param _engine: 실행 엔진
	public constructor(_engine: RunnerEngine)
	{
		this.engine_ = _engine;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 출력 끝부분과 기록을 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const id = typeof _args["Id"] === "string" ? _args["Id"].trim() : "";
		const entry = this.engine_.Store.Find(id);
		if (entry === null)
			throw new Error(`없는 스크립트 Id입니다: ${id}`);
		const raw = _args["MaxChars"];
		const max = typeof raw === "number" && Number.isFinite(raw) ? Math.min(kMaxChars, Math.max(100, Math.round(raw))) : kDefaultChars;
		const output = await this.engine_.ReadOutputAsync(id, max);
		return {
			Ok: true,
			Id: id,
			Title: entry.Title,
			Running: this.engine_.IsRunning(id),
			LastRun: ScriptFormat.RunSummary(entry.LastRun),
			Output: output.Text,
			Truncated: output.Truncated,
			TotalChars: output.TotalChars,
		};
	}
}
