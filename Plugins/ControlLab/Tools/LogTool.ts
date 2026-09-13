/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: Log Tool. 이벤트 1건을 쌓는다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import type { ControlStore } from "../ControlStore";
import type { TControlEventKind } from "../Types";

const kKinds: ReadonlyArray<string> = ["info", "success", "warn", "error"];

//////////////////////////////////////////////////////////////////////////////////////
// 인자를 읽는다. Name 없으면 throw.
// @param _args: 원본 인자
function ReadLogArgs(_args: Record<string, unknown>): { Kind: TControlEventKind; Name: string; Detail: string }
{
	const name = _args["Name"];
	if (typeof name !== "string" || name.trim().length === 0)
		throw new Error("Name required");
	const rawKind = _args["Kind"];
	const kind: TControlEventKind = typeof rawKind === "string" && kKinds.includes(rawKind)
		? rawKind as TControlEventKind
		: "info";
	const rawDetail = _args["Detail"];
	const detail = typeof rawDetail === "string" ? rawDetail : "";
	return { Kind: kind, Name: name.trim(), Detail: detail };
}

export class LogTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Log";
	public readonly Description = "컨트롤 이벤트 1건을 기록한다. Name은 필수.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Kind: { type: "string", enum: ["info", "success", "warn", "error"] },
			Name: { type: "string" },
			Detail: { type: "string" },
		},
		required: ["Name"],
	};
	// 메모리 기록만이라 승인 없이 둔다.
	public readonly DefaultApproval = "auto" as const;
	private readonly store_: ControlStore;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소로 만든다. Index OnActivate에서 주입.
	// @param _store: 이벤트 저장소
	public constructor(_store: ControlStore)
	{
		this.store_ = _store;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이벤트를 쌓고 개수를 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		let parsed: { Kind: TControlEventKind; Name: string; Detail: string };
		try
		{
			parsed = ReadLogArgs(_args);
		}
		catch (_e)
		{
			return Promise.reject(_e instanceof Error ? _e : new Error(String(_e)));
		}
		this.store_.Log(parsed.Kind, parsed.Name, parsed.Detail);
		return Promise.resolve({ Ok: true, Kind: parsed.Kind, Count: this.store_.Count() });
	}
}
