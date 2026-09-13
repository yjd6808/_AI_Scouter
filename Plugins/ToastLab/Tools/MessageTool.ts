/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: Message Tool. App·바탕화면 확인창을 띄우고 버튼 결과를 돌려준다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { TMessageKind, TMessageResult, TMessageScope, TMessageSink } from "../Types";

const kScopes: ReadonlyArray<string> = ["App", "Global"];
const kKinds: ReadonlyArray<string> = ["ok", "yesno"];

export class MessageTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Message";
	public readonly Description = "확인 메시지 박스를 띄운다. Scope는 App·Global, Kind는 ok·yesno.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Scope: { type: "string", enum: ["App", "Global"] },
			Title: { type: "string" },
			Message: { type: "string" },
			Kind: { type: "string", enum: ["ok", "yesno"] },
			DurationSec: { type: "number" },
			Topmost: { type: "boolean" },
		},
		required: ["Title"],
	};
	// 화면 표시만 하고 상태를 바꾸지 않아 승인 없이 둔다.
	public readonly DefaultApproval = "auto" as const;
	private readonly message_: TMessageSink;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 확인창 싱크로 만든다. Index OnActivate에서 주입.
	// @param _message: 범위·제목·내용 표시자
	public constructor(_message: TMessageSink)
	{
		this.message_ = _message;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 확인창을 띄운다. 결과명을 함께 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const title = _args["Title"];
		if (typeof title !== "string" || title.trim().length === 0)
			throw new Error("Title required");
		const rawScope = _args["Scope"];
		const scope: TMessageScope = typeof rawScope === "string" && kScopes.includes(rawScope)
			? rawScope as TMessageScope
			: "App";
		const rawKind = _args["Kind"];
		const kind: TMessageKind = typeof rawKind === "string" && kKinds.includes(rawKind)
			? rawKind as TMessageKind
			: "ok";
		const rawMessage = _args["Message"];
		const message = typeof rawMessage === "string" ? rawMessage : "";
		const rawSec = _args["DurationSec"];
		const durationSec = typeof rawSec === "number" && Number.isFinite(rawSec) && rawSec >= 0 ? rawSec : 30;
		const topmost = _args["Topmost"] === true;
		const result: TMessageResult = await this.message_(scope, title.trim(), message, kind, durationSec, topmost);
		return { Ok: true, Scope: scope, Kind: kind, Result: result };
	}
}
