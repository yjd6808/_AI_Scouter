/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScriptRunner Plugin. 엔진 1개를 만들어 Tool 7종과 화면이 함께 쓰게 배선한다.
	      복원 판정(부팅 여부 포함)은 부팅 표식을 비동기로 읽은 뒤에 하고, 예약 tick은 그다음에 건다.
	      실행 로그는 RunLog(logs/history.log)에 쌓고, 실행 중 출력은 OutputTailer가 같은 tick에 이어 읽는다.
	      엔진을 두 번 만들면 예약이 두 번 실행되므로 인스턴스는 여기 하나뿐이다.
	      설정은 스냅샷을 뜨지 않고 getter로 넘겨 실행 시점에 읽는다.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import type { IDisposable } from "@scouter/gui";
import { OutputTailer } from "./OutputTailer";
import { RunLog } from "./RunLog";
import { RunnerEngine } from "./RunnerEngine";
import { ScriptLauncher } from "./ScriptLauncher";
import { ScriptStore } from "./ScriptStore";
import { GetLogTool } from "./Tools/GetLogTool";
import { GetOutputTool } from "./Tools/GetOutputTool";
import { ListTool } from "./Tools/ListTool";
import { PresetTool } from "./Tools/PresetTool";
import { RegisterTool } from "./Tools/RegisterTool";
import { RemoveTool } from "./Tools/RemoveTool";
import { RunTool } from "./Tools/RunTool";
import { StopTool } from "./Tools/StopTool";
import { UpdateTool } from "./Tools/UpdateTool";
import { MainControl } from "./Views/MainControl";
import type { ILauncherOptions, IScriptEntry } from "./Types";

const kMinTickMs = 200;
const kViewTickMs = 1000;
const kMissedListMax = 5;

export default class ScriptRunnerPlugin extends PluginBase
{
	// ==================== 멤버 ====================
	private engine_: RunnerEngine | null = null;
	private timer_: IDisposable | null = null;
	private tickHook_: IDisposable | null = null;
	private stopBadge_: (() => void) | null = null;
	private runLog_: RunLog | null = null;
	private tailer_: OutputTailer | null = null;
	private stopTail_: (() => void) | null = null;
	// 복원 판정이 끝나기 전에는 예약 tick을 걸지 않는다. 부팅으로 풀릴 예약이 먼저 실행되면 안 된다.
	private restored_ = false;

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진을 배선하고 복원 판정 → 예약 tick → Tool·화면 등록 순으로 띄운다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		const options: ILauncherOptions = {
			PythonExe: () => _ctx.Settings.Get<string>("PythonExe", "python"),
			NodeExe: () => _ctx.Settings.Get<string>("NodeExe", "node"),
			MaxLogKB: () => _ctx.Settings.Get<number>("MaxLogKB", 4096),
		};
		const store = new ScriptStore(_ctx.Storage);
		const launcher = new ScriptLauncher(_ctx.Shell, _ctx.Fs, _ctx.Paths.StorageDir, options);
		const engine = new RunnerEngine({
			Store: store,
			Launcher: launcher,
			Now: { Now: () => Date.now() },
			Logger: _ctx.Logger,
			Missed: (_missed: IScriptEntry[]) =>
			{
				const lines = _missed.slice(0, kMissedListMax).map((_e) => `· ${_e.Title}`).join("\n");
				const more = _missed.length > kMissedListMax ? `\n외 ${_missed.length - kMissedListMax}건` : "";
				_ctx.Ui.Notify("warn", `앱이 꺼져 있는 동안 지나간 예약 ${_missed.length}건 (실행하지 않음)\n${lines}${more}`);
			},
		});
		this.engine_ = engine;
		const runLog = new RunLog(_ctx.Fs, `${_ctx.Paths.StorageDir}/logs/history.log`, {
			MaxLines: () => _ctx.Settings.Get<number>("LogHistoryLines", 5000),
		});
		this.runLog_ = runLog;
		void runLog.LoadAsync();
		const tailer = new OutputTailer(engine, launcher, runLog, { Now: () => Date.now() });
		this.tailer_ = tailer;
		this.stopTail_ = tailer.Attach();
		this.restored_ = false;
		void this.RestoreAsync(_ctx, engine, launcher);
		this.tickHook_ = _ctx.Settings.On("TickMs", () => { this.RearmTimer(_ctx); });
		this.stopBadge_ = engine.OnChanged(() => { _ctx.Shell.SetBadge(engine.RunningCount); });
		_ctx.Tools.Register(new ListTool(engine));
		_ctx.Tools.Register(new RegisterTool(engine));
		_ctx.Tools.Register(new UpdateTool(engine));
		_ctx.Tools.Register(new RunTool(engine));
		_ctx.Tools.Register(new StopTool(engine));
		_ctx.Tools.Register(new RemoveTool(engine));
		_ctx.Tools.Register(new GetOutputTool(engine));
		_ctx.Tools.Register(new GetLogTool(runLog, engine));
		_ctx.Tools.Register(new PresetTool(engine));
		_ctx.Ui.RegisterWindow("Main", MainControl);
		MainControl.Configure(engine, runLog, {
			// WhenVisible: true — 이 화면이 보일 때만 남은 시간을 다시 쓴다. 예약 tick은 RearmTimer가 따로 건다.
			Tick: (_handler: (_nowMs: number) => void): (() => void) =>
			{
				const hook = _ctx.Schedule.Tick((_nowMs: number) => { _handler(_nowMs); }, { PeriodMs: kViewTickMs, WhenVisible: true });
				return () => { hook.Dispose(); };
			},
			Confirm: (_message: string): Promise<boolean> => _ctx.Ui.Confirm(_message),
			Alert: (_title: string, _message: string): void =>
			{
				void _ctx.Ui.MessageBox({ Scope: "App", Title: _title, Message: _message, Kind: "ok" });
			},
		});
		void this.RegisterRecipesAsync(_ctx);
		_ctx.Prompts.Register("ScriptRunner", {
			Description: "스크립트 등록·실행·예약 절차",
			Build: () =>
			{
				return "ScriptRunner 레시피에 따라 scouter://ScriptRunner/recipes/ScriptRunner 리소스를 읽고, List로 현재 등록 상태를 확인한 뒤 Register·Run·Stop·Update·Preset·GetOutput·GetLog를 써라.";
			},
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 타이머·구독을 끊고 실행 중인 스크립트를 중지한다. 엔진이 사라지면 중지할 길이 없어지기 때문이다.
	protected override OnDeactivate(): void
	{
		this.timer_?.Dispose();
		this.timer_ = null;
		this.restored_ = false;
		this.tickHook_?.Dispose();
		this.tickHook_ = null;
		this.stopBadge_?.();
		this.stopBadge_ = null;
		this.stopTail_?.();
		this.stopTail_ = null;
		this.tailer_ = null;
		void this.runLog_?.FlushAsync();
		this.runLog_ = null;
		const engine = this.engine_;
		this.engine_ = null;
		if (engine !== null && engine.RunningCount > 0)
			void engine.StopAllAsync();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 부팅 표식을 읽어 복원 판정을 하고, 그다음에 예약 tick을 건다.
	// 표식 읽기는 PowerShell 1회라 OnActivate 10초 제한에 걸리지 않게 비동기로 뺀다.
	// @param _ctx: 컨텍스트
	// @param _engine: 이번 활성화에서 만든 엔진
	// @param _launcher: 실행기(부팅 표식 읽기)
	private async RestoreAsync(_ctx: IPluginContext, _engine: RunnerEngine, _launcher: ScriptLauncher): Promise<void>
	{
		const bootMark = await _launcher.QueryBootMarkAsync();
		if (this.engine_ !== _engine)
			return;
		const report = _engine.Restore(bootMark);
		_ctx.Logger.Info("[ScriptRunner] 복원 완료", {
			BootMarkMs: bootMark,
			Rebooted: report.Rebooted,
			ClearedByBoot: report.ClearedByBoot.map((_e) => _e.Id),
			Missed: report.Missed.length,
			Advanced: report.Advanced,
			Interrupted: report.Interrupted,
		});
		this.restored_ = true;
		this.RearmTimer(_ctx);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 점검을 앱 공용 틱에 얹는다. 화면이 안 보여도 실행해야 하므로 WhenVisible은 쓰지 않는다.
	// TickMs 설정이 바뀌면 다시 건다. 복원 판정 전이면 걸지 않는다.
	// @param _ctx: 컨텍스트
	private RearmTimer(_ctx: IPluginContext): void
	{
		this.timer_?.Dispose();
		const engine = this.engine_;
		if (engine === null || !this.restored_)
			return;
		const tickMs = Math.max(kMinTickMs, Math.round(_ctx.Settings.Get<number>("TickMs", 1000)));
		const tailer = this.tailer_;
		// 예약 점검과 실행 중 출력 수집을 같은 tick에 얹는다. 화면이 안 보여도 로그는 쌓여야 한다.
		this.timer_ = _ctx.Schedule.Tick(() =>
		{
			engine.Tick();
			if (tailer !== null)
				void tailer.PollAsync();
		}, { PeriodMs: tickMs });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 레시피를 리소스로 올린다. 실패해도 활성화를 막지 않는다.
	// @param _ctx: 컨텍스트
	private async RegisterRecipesAsync(_ctx: IPluginContext): Promise<void>
	{
		try
		{
			const text = await _ctx.Fs.ReadText(`${_ctx.Paths.PluginDir}/Recipes/ScriptRunner.md`);
			_ctx.Resources.Register("recipes/ScriptRunner", text, "text/markdown");
		}
		catch
		{
			// 무시. 레시피만 빠진다.
		}
	}
}
