/*
	작성자: 윤정도
	생성일: 2026-11-14
	=====
	설명: GetLog Tool. 실행 로그(시작·출력·종료·예약 알림 줄)의 최근 줄을 돌려준다.
	      앱을 다시 켜도 남는 기록이라 지난 실행 출력도 볼 수 있다. 읽기 전용이라 승인 없이 조회된다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { RunLog } from "../RunLog";
import { RunnerEngine } from "../RunnerEngine";

const kDefaultLines = 200;
const kMaxLines = 2000;
const kMaxChars = 60000;

export class GetLogTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "GetLog";
	public readonly Description = "ScriptRunner 실행 로그의 최근 줄을 돌려준다(화면 아래 [실행 로그]와 같은 내용, 앱을 다시 켜도 남음). 줄 형식: \"MM-DD HH:mm:ss [Id 제목] 내용\". ▶ 실행 시작, ■ 종료 결과, ⚠ 예약 알림 줄이 섞여 있다. Id를 주면 그 항목 줄만, Lines(기본 200, 최대 2000)로 끝에서부터 자른다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Id: { type: "string", description: "이 항목 줄만(생략하면 전체)" },
			Lines: { type: "number", minimum: 1, maximum: kMaxLines, description: "끝에서부터 돌려줄 줄 수(기본 200)" },
		},
	};
	// 로그를 읽기만 한다.
	public readonly Annotations = { ReadOnly: true };
	private readonly log_: RunLog;
	private readonly engine_: RunnerEngine;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 로그와 엔진을 주입받는다.
	// @param _log: 실행 로그
	// @param _engine: 실행 엔진(Id 확인용)
	public constructor(_log: RunLog, _engine: RunnerEngine)
	{
		this.log_ = _log;
		this.engine_ = _engine;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 최근 줄을 돌려준다. 결과 64KB 잘림을 피하려고 글자 수도 끝에서부터 자른다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const id = typeof _args["Id"] === "string" ? _args["Id"].trim() : "";
		if (id.length > 0 && this.engine_.Store.Find(id) === null && this.log_.List(id, 1).length === 0)
			return Promise.reject(new Error(`없는 스크립트 Id이고 로그도 없습니다: ${id}`));
		const raw = _args["Lines"];
		const limit = typeof raw === "number" && Number.isFinite(raw) ? Math.min(kMaxLines, Math.max(1, Math.round(raw))) : kDefaultLines;
		const lines = this.log_.List(id, limit).map((_l) => RunLog.Format(_l));
		let total = 0;
		let start = lines.length;
		while (start > 0 && total + (lines[start - 1]?.length ?? 0) + 1 <= kMaxChars)
		{
			total += (lines[start - 1]?.length ?? 0) + 1;
			--start;
		}
		return Promise.resolve({
			Ok: true,
			Id: id,
			TotalLines: this.log_.List(id).length,
			Returned: lines.length - start,
			Truncated: start > 0,
			Lines: lines.slice(start),
		});
	}
}
