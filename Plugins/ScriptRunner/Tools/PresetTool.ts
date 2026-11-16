/*
	작성자: 윤정도
	생성일: 2026-11-14
	=====
	설명: Preset Tool. 스크립트별 인자 프리셋을 저장·삭제·불러오기 한다(화면 행의 프리셋 콤보박스와 같다).
	      불러오면 인자 값이 프리셋 값으로 바뀌고 선택 상태가 된다. 불러와서 바로 실행하려면 Run의 Preset을 쓴다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { RunnerEngine } from "../RunnerEngine";
import { ScriptFormat } from "../ScriptFormat";
import { SpecReader } from "../SpecReader";
import { ScheduleProps } from "./ScheduleProps";

export class PresetTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Preset";
	public readonly Description = "스크립트별 인자 프리셋을 다룬다(Id·Action·Name 필수). Action=Save: 지금 인자 값을 Name으로 저장하고 선택(같은 이름은 덮어씀). ArgValues를 주면 그 값으로 저장하되 지금 입력값과 선택은 그대로 둔다. Action=Delete: 삭제. Action=Load: 프리셋 값을 인자에 채우고 선택(Name=\"\"이면 선택을 '없음'으로). 저장된 프리셋은 List의 Items[].Presets에 있다. 불러와서 바로 실행하려면 Run에 Preset을 준다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Id: { type: "string", description: "항목 Id" },
			Action: { type: "string", enum: ["Save", "Delete", "Load"], description: "Save=저장(덮어쓰기), Delete=삭제, Load=불러오기" },
			Name: { type: "string", description: "프리셋 이름(예: \"release\", \"release-2\"). \"없음\"은 쓸 수 없다" },
			ArgValues: ScheduleProps.ArgValues(),
		},
		required: ["Id", "Action", "Name"],
	};
	// 사용자 결정(2026-11-12): MCP 쓰기 Tool은 전부 auto. Plugin 자기 저장소만 바꾸고 실행하지는 않는다.
	public readonly DefaultApproval = "auto" as const;
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
	// 동작에 맞춰 엔진을 부르고 항목 요약을 돌려준다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const id = typeof _args["Id"] === "string" ? _args["Id"].trim() : "";
		const name = typeof _args["Name"] === "string" ? _args["Name"] : "";
		const action = _args["Action"];
		let outcome;
		if (action === "Save")
		{
			const values = SpecReader.ReadValues(_args["ArgValues"]);
			if (!values.Ok)
				return Promise.reject(new Error(values.Error));
			outcome = this.engine_.SavePreset(id, name, values.Values);
		}
		else if (action === "Delete")
			outcome = this.engine_.DeletePreset(id, name);
		else if (action === "Load")
			outcome = this.engine_.ApplyPreset(id, name);
		else
			return Promise.reject(new Error("Action은 \"Save\", \"Delete\", \"Load\" 중 하나여야 합니다."));
		if (!outcome.Ok)
			return Promise.reject(new Error(outcome.Error));
		return Promise.resolve({ Ok: true, Action: action, Item: ScriptFormat.Summary(outcome.Entry, this.engine_.StateOf(outcome.Entry), Date.now()) });
	}
}
