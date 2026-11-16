/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: Run Tool. 등록된 스크립트를 즉시 실행한다. 기본은 바로 돌아오고, Wait=true면 끝날 때까지
	      (최대 WaitTimeoutSec) 기다려 종료 코드와 출력 끝부분을 함께 돌려준다.
	      기다리다 시간이 넘거나 호출이 취소돼도 스크립트는 멈추지 않는다 — 멈추려면 Stop을 부른다.
*/

import type { ITool, IToolCall } from "@scouter/plugin-api";
import { RunnerEngine } from "../RunnerEngine";
import { ScriptFormat } from "../ScriptFormat";
import { SpecReader } from "../SpecReader";
import type { IRunRecord } from "../Types";
import { ScheduleProps } from "./ScheduleProps";

const kDefaultWaitSec = 60;
const kMaxWaitSec = 600;
const kDefaultOutputChars = 8000;
const kMaxOutputChars = 60000;

export class RunTool implements ITool
{
	// ==================== 멤버 ====================
	public readonly Name = "Run";
	public readonly Description = "등록된 스크립트를 즉시 실행한다(Id 필수). Preset을 주면 그 프리셋 값을 불러와 실행하고, ArgValues로 인자 값을 바꿔 실행할 수도 있다(둘 다 주면 프리셋 → ArgValues 순, 값은 저장됨). 기본은 실행만 걸고 바로 돌아온다. Wait=true면 끝날 때까지 최대 WaitTimeoutSec(기본 60, 최대 600) 기다려 Result·ExitCode·Output(끝부분)을 돌려준다. 이미 실행 중이면 실패한다.";
	public readonly InputSchema = {
		type: "object",
		properties: {
			Id: { type: "string", description: "실행할 항목 Id" },
			Preset: { type: "string", description: "먼저 불러올 프리셋 이름(List의 Items[].Presets[].Name)" },
			ArgValues: ScheduleProps.ArgValues(),
			Wait: { type: "boolean", description: "true면 실행이 끝날 때까지 기다린다" },
			WaitTimeoutSec: { type: "number", minimum: 1, maximum: kMaxWaitSec, description: "Wait=true일 때 최대 대기 초(기본 60)" },
			OutputChars: { type: "number", minimum: 100, maximum: kMaxOutputChars, description: "Wait=true일 때 돌려줄 출력 끝부분 글자 수(기본 8000)" },
		},
		required: ["Id"],
	};
	// 사용자 결정(2026-11-12): AI가 승인 없이 스크립트를 실행할 수 있게 auto로 둔다(Process 권한 경고 배지가 뜬다).
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
	// 실행을 걸고, 원하면 끝날 때까지 기다린다.
	// @param _args: 인자
	// @param _call: 호출 정보
	public async Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>
	{
		const id = typeof _args["Id"] === "string" ? _args["Id"].trim() : "";
		const values = SpecReader.ReadValues(_args["ArgValues"]);
		if (!values.Ok)
			throw new Error(values.Error);
		const preset = typeof _args["Preset"] === "string" ? _args["Preset"] : undefined;
		const run = this.engine_.Run(id, "Mcp", values.Values, preset);
		if (!run.Ok)
			throw new Error(run.Error);
		if (_args["Wait"] !== true)
			return { Ok: true, Id: id, RunId: run.RunId, Waited: false };
		const waitSec = RunTool.Clamp(_args["WaitTimeoutSec"], 1, kMaxWaitSec, kDefaultWaitSec);
		_call.Progress(0, `${id} 실행 중 (최대 ${waitSec}초 대기)`);
		const record = await RunTool.WaitAsync(run.Done, waitSec * 1000, _call.Signal);
		const output = await this.engine_.ReadOutputAsync(id, RunTool.Clamp(_args["OutputChars"], 100, kMaxOutputChars, kDefaultOutputChars));
		const entry = this.engine_.Store.Find(id);
		return {
			Ok: true,
			Id: id,
			RunId: run.RunId,
			Waited: true,
			Finished: record !== null,
			LastRun: ScriptFormat.RunSummary(record ?? entry?.LastRun ?? null),
			Output: output.Text,
			OutputTruncated: output.Truncated,
			OutputTotalChars: output.TotalChars,
		};
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 종료를 제한 시간·취소 신호와 경주시킨다. 끝났으면 기록, 아니면 null.
	// @param _done: 실행 종료 약속
	// @param _timeoutMs: 제한 시간
	// @param _signal: 호출 취소 신호
	private static WaitAsync(_done: Promise<IRunRecord>, _timeoutMs: number, _signal: AbortSignal): Promise<IRunRecord | null>
	{
		return new Promise((_resolve) =>
		{
			const timer = setTimeout(() => { _resolve(null); }, _timeoutMs);
			const onAbort = (): void =>
			{
				clearTimeout(timer);
				_resolve(null);
			};
			_signal.addEventListener("abort", onAbort, { once: true });
			void _done.then((_record) =>
			{
				clearTimeout(timer);
				_signal.removeEventListener("abort", onAbort);
				_resolve(_record);
			});
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 숫자 입력을 범위 안으로 굳힌다. 숫자가 아니면 기본값.
	// @param _value: 입력
	// @param _min: 최소
	// @param _max: 최대
	// @param _def: 기본값
	private static Clamp(_value: unknown, _min: number, _max: number, _def: number): number
	{
		if (typeof _value !== "number" || !Number.isFinite(_value))
			return _def;
		return Math.min(_max, Math.max(_min, Math.round(_value)));
	}
}
