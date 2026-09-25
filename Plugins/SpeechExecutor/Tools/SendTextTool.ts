/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: SendText Tool. 연결된 피어에게 텍스트 1건 전송.
*/

import type { ITool } from "@scouter/plugin-api";
import type { SpeechEngine } from "../SpeechEngine";

export class SendTextTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "SendText";
	public readonly Description = "연결된 피어에게 텍스트 1건을 전송한다. 연결 없으면 실패.";
	public readonly InputSchema = {
		type: "object",
		properties: { Text: { type: "string" } },
		required: ["Text"],
	};
	// 저위험 쓰기이므로 자동 승인.
	public readonly DefaultApproval = "auto" as const;
	private readonly engine_: SpeechEngine;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진으로 만든다.
	// @param _engine: 엔진
	public constructor(_engine: SpeechEngine)
	{
		this.engine_ = _engine;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트를 전송한다.
	// @param _args: 인자
	public Run(_args: Record<string, unknown>): Promise<unknown>
	{
		const text = _args["Text"];
		if (typeof text !== "string" || text.trim().length === 0)
			return Promise.reject(new Error("Text required"));
		if (this.engine_.Role() === "idle")
			return Promise.reject(new Error("연결 없음 (리슨/연결 먼저)"));
		this.engine_.SendText(text.trim());
		return Promise.resolve({ Ok: true });
	}
}
