/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: SaveGroup Tool. 알람 스펙 여러 개를 이름 붙은 그룹(템플릿)으로 저장한다.
	      같은 이름이 있으면 덮어쓴다. 이미 예약된 알람은 스냅샷이라 영향받지 않는다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { AlarmEngine } from "../AlarmEngine";
import { SpecFactory } from "../SpecFactory";
import type { IAlarmOptions, IAlarmSpec } from "../Types";

export class SaveGroupTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "SaveGroup";
	public readonly Description = "알람 스펙 목록을 그룹으로 저장한다. Specs 요소는 {Title, Seconds} 또는 {Title, AtTime, RollToNextDay} 형태다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Name: { type: "string", description: "그룹 이름. 같은 이름이면 덮어쓴다" },
			Specs: {
				type: "array",
				description: "알람 스펙 목록",
				items: {
					type: "object",
					properties: {
						Title: { type: "string" },
						Message: { type: "string" },
						Seconds: { type: "number", description: "상대 알람일 때 몇 초 뒤" },
						AtTime: { type: "string", description: "절대 알람일 때 \"HH:mm\"" },
						RollToNextDay: { type: "boolean" },
						KindUi: { type: "string", enum: ["ok", "yesno"] },
						DurationSec: { type: "number" },
						Topmost: { type: "boolean" },
						WithToast: { type: "boolean" },
					},
					required: ["Title"],
				},
			},
		},
		required: ["Name", "Specs"],
	};
	// 자기 저장소의 템플릿만 건드리고 예약된 알람에는 영향이 없어 승인 없이 둔다.
	public readonly DefaultApproval = "auto" as const;
	private readonly engine_: AlarmEngine;
	private readonly options_: IAlarmOptions;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진과 설정 getter를 주입받는다.
	// @param _engine: 알람 엔진
	// @param _options: 설정 getter 묶음
	public constructor(_engine: AlarmEngine, _options: IAlarmOptions)
	{
		this.engine_ = _engine;
		this.options_ = _options;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹을 저장한다. 살릴 수 있는 스펙이 하나도 없으면 실패로 던진다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const name = _args["Name"];
		if (typeof name !== "string" || name.trim().length === 0)
			return Promise.reject(new Error("Name required"));
		const rawSpecs = _args["Specs"];
		if (!Array.isArray(rawSpecs))
			return Promise.reject(new Error("Specs는 배열이어야 한다"));
		const store = this.engine_.Store;
		const specs: IAlarmSpec[] = [];
		for (const raw of rawSpecs as unknown[])
		{
			const spec = SpecFactory.FromRecord(raw, store.NewId("spec"), this.options_);
			if (spec !== null)
				specs.push(spec);
		}
		if (specs.length === 0)
			return Promise.reject(new Error("살릴 수 있는 스펙이 없다. 각 항목에 Title이 필요하다"));
		const trimmed = name.trim();
		const exist = store.FindGroupByName(trimmed);
		const id = exist === null ? store.NewId("group") : exist.Id;
		store.SaveGroup({ Id: id, Name: trimmed, Description: "", Specs: specs });
		return Promise.resolve({ Ok: true, Id: id, Name: trimmed, Count: specs.length, Replaced: exist !== null });
	}
}
