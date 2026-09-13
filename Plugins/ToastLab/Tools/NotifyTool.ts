/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: Notify Tool. 우측 하단 토스트를 띄운다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { TToastKind, TNotifySink } from "../Types";

const kKinds: ReadonlyArray<TToastKind> = ["info", "success", "warn", "error"];

export class NotifyTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Notify";
	public readonly Description = "우측 하단 알림 팝업(토스트)을 띄운다. Kind는 info·success·warn·error.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Kind: { type: "string", enum: ["info", "success", "warn", "error"] },
			Title: { type: "string" },
			Message: { type: "string" },
			Global: { type: "boolean" },
		},
		required: ["Title"],
	};
	// 화면 표시만 하고 상태를 바꾸지 않아 승인 없이 둔다.
	public readonly DefaultApproval = "auto" as const;
	private readonly notify_: TNotifySink;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 알림 싱크로 만든다. Index OnActivate에서 주입.
	// @param _notify: 종류·제목·내용 표시자
	public constructor(_notify: TNotifySink)
	{
		this.notify_ = _notify;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 토스트를 띄운다. 동기 작업이라 Promise로 감싼다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const title = _args["Title"];
		if (typeof title !== "string" || title.trim().length === 0)
			return Promise.reject(new Error("Title required"));
		const rawKind = _args["Kind"];
		const kind: TToastKind = typeof rawKind === "string" && (kKinds as ReadonlyArray<string>).includes(rawKind)
			? rawKind as TToastKind
			: "info";
		const rawMessage = _args["Message"];
		const message = typeof rawMessage === "string" ? rawMessage : "";
		const global = _args["Global"] === true;
		this.notify_(kind, title.trim(), message, global);
		return Promise.resolve({ Ok: true, Kind: kind, Global: global });
	}
}
