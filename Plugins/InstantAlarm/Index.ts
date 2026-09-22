/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: InstantAlarm Plugin. 엔진 1개를 만들어 Tool 6종과 화면이 함께 쓰게 배선한다.
	      엔진을 두 번 만들면 복원 판정이 두 번 돌아 알람이 두 번 울린다 — 인스턴스는 여기 하나뿐이다.
	      설정은 스냅샷을 뜨지 않고 getter로 넘겨 실행 시점에 읽는다.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import type { IDisposable } from "@scouter/gui";
import { AlarmEngine } from "./AlarmEngine";
import { AlarmStore } from "./AlarmStore";
import { ArmAfterTool } from "./Tools/ArmAfterTool";
import { ArmAtTool } from "./Tools/ArmAtTool";
import { ArmGroupTool } from "./Tools/ArmGroupTool";
import { CancelTool } from "./Tools/CancelTool";
import { ListTool } from "./Tools/ListTool";
import { SaveGroupTool } from "./Tools/SaveGroupTool";
import { MainControl } from "./Views/MainControl";
import type { IAlarmOptions, IAlarmSpec, INowSource, TAlarmResult, TFireSink, TMissedPolicy, TMissedSink } from "./Types";

const kMinTickMs = 200;
const kViewTickMs = 1000;

export default class InstantAlarmPlugin extends PluginBase
{
	// ==================== 멤버 ====================
	private engine_: AlarmEngine | null = null;
	private timer_: IDisposable | null = null;
	private tickHook_: IDisposable | null = null;
	private schema_: unknown = null;

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진을 배선하고 복원 판정 → 주기 tick → Tool·화면 등록 순으로 띄운다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		const options = InstantAlarmPlugin.BuildOptions(_ctx);
		const now: INowSource = { Now: () => Date.now() };
		const store = new AlarmStore(_ctx.Storage, now);
		// 알람은 Scope "Global"로 띄운다 — 앱 창이 최소화되거나 뒤로 가려 있어도 바탕화면 위로 올라온다.
		// Topmost는 스펙(항상 위 체크)을 그대로 넘긴다. 주 창을 앞으로 올리는 것과 작업 표시줄
		// 아이콘 깜빡임(Flash)은 프레임워크가 기본으로 맡는다. 확인창이 닫히면 깜빡임도 멎는다.
		// DurationMs는 0을 그대로 넘겨야 한다. 전역 확인창의 기본값 30000은 값이 없을 때만 적용되고,
		// 0은 "자동으로 닫지 않음"으로 해석된다(Renderer/Message/Host.ts는 DurationMs > 0일 때만 타이머를 건다).
		const show = (_spec: IAlarmSpec): Promise<TAlarmResult> =>
		{
			const title = _spec.Title.length > 0 ? _spec.Title : "알람";
			if (_spec.WithToast)
				_ctx.Ui.Notify("info", _spec.Message.length > 0 ? `${title}\n${_spec.Message}` : title);
			return _ctx.Ui.MessageBox({
				Scope: "Global",
				Title: title,
				Message: _spec.Message,
				Kind: _spec.KindUi,
				DurationMs: Math.max(0, Math.round(_spec.DurationSec * 1000)),
				Topmost: _spec.Topmost,
			});
		};
		const fire: TFireSink = (_alarm) => show(_alarm.Spec);
		const missed: TMissedSink = (_missed, _total) =>
		{
			const lines = _missed.map((_a) => `· ${_a.Spec.Title.length > 0 ? _a.Spec.Title : _a.SpecId}`).join("\n");
			const more = _total > _missed.length ? `\n외 ${_total - _missed.length}건` : "";
			_ctx.Ui.Notify("warn", `놓친 알람 ${_total}건\n${lines}${more}`);
		};
		const engine = new AlarmEngine({ Store: store, Now: now, Fire: fire, Missed: missed, Options: options, Logger: _ctx.Logger });
		this.engine_ = engine;
		const report = engine.Restore();
		_ctx.Logger.Info("[InstantAlarm] 복원 완료", { Missed: report.Missed.length, Grace: report.Grace.length, ClockBack: report.ClockBack });
		this.RearmTimer(_ctx, options);
		this.tickHook_ = _ctx.Settings.On("TickMs", () => { this.RearmTimer(_ctx, options); });
		_ctx.Tools.Register(new ArmAfterTool(engine, options));
		_ctx.Tools.Register(new ArmAtTool(engine, options));
		_ctx.Tools.Register(new ListTool(engine));
		_ctx.Tools.Register(new ArmGroupTool(engine));
		_ctx.Tools.Register(new CancelTool(engine));
		_ctx.Tools.Register(new SaveGroupTool(engine, options));
		_ctx.Ui.RegisterWindow("Main", MainControl);
		MainControl.Configure(engine, options, {
			// WhenVisible: true — 이 Plugin 화면이 보일 때만 UI가 갱신된다. 엔진 tick은 위에서 따로 건다.
			Tick: (_handler: (_nowMs: number) => void): (() => void) =>
			{
				const hook = _ctx.Schedule.Tick((_nowMs: number) => { _handler(_nowMs); }, { PeriodMs: kViewTickMs, WhenVisible: true });
				return () => { hook.Dispose(); };
			},
			Preview: (_spec: IAlarmSpec): void => { void show(_spec); },
			// 입력 오류 안내는 앱 모달로 충분하다. 전역 확인창까지 띄우면 화면 밖으로 튀어나가 성가시다.
			Alert: (_title: string, _message: string): void =>
			{
				void _ctx.Ui.MessageBox({ Scope: "App", Title: _title, Message: _message, Kind: "ok" });
			},
			SettingsSchema: (): unknown => this.schema_,
			SettingsValues: (): Record<string, unknown> => InstantAlarmPlugin.ReadSettings(_ctx, this.schema_),
			SettingsSet: (_key: string, _value: unknown): void => { _ctx.Settings.Set(_key, _value); },
		});
		void this.RegisterRecipesAsync(_ctx);
		void this.LoadSchemaAsync(_ctx);
		_ctx.Prompts.Register("InstantAlarm", {
			Description: "알람 예약 절차",
			Build: () =>
			{
				return "InstantAlarm 레시피에 따라 scouter://InstantAlarm/recipes/InstantAlarm 리소스를 읽고 예약 규칙을 지켜라.";
			},
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 타이머·설정 구독을 정리한다. 컨텍스트가 알아서 걷어가지만 명시적으로 끊는다.
	protected override OnDeactivate(): void
	{
		this.timer_?.Dispose();
		this.timer_ = null;
		this.tickHook_?.Dispose();
		this.tickHook_ = null;
		this.engine_ = null;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 getter 묶음을 만든다. 값을 미리 읽지 않고 호출 시점에 읽는다.
	// @param _ctx: 컨텍스트
	private static BuildOptions(_ctx: IPluginContext): IAlarmOptions
	{
		return {
			DefaultDurationSec: () => _ctx.Settings.Get<number>("DefaultDurationSec", 0),
			DefaultTopmost: () => _ctx.Settings.Get<boolean>("DefaultTopmost", true),
			TickMs: () => _ctx.Settings.Get<number>("TickMs", 1000),
			MissedPolicy: () => _ctx.Settings.Get<TMissedPolicy>("MissedPolicy", "toast"),
			MissedGraceSec: () => _ctx.Settings.Get<number>("MissedGraceSec", 0),
			MissedListMax: () => _ctx.Settings.Get<number>("MissedListMax", 3),
			HistoryKeepDays: () => _ctx.Settings.Get<number>("HistoryKeepDays", 7),
			UrgentSec: () => _ctx.Settings.Get<number>("UrgentSec", 60),
			DefaultGroup: () => _ctx.Settings.Get<string>("DefaultGroup", ""),
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 스키마에 적힌 키만 골라 현재 값을 읽는다. PropertyGrid에 넣을 값 묶음이다.
	// @param _ctx: 컨텍스트
	// @param _schema: 설정 스키마(못 읽었으면 null)
	private static ReadSettings(_ctx: IPluginContext, _schema: unknown): Record<string, unknown>
	{
		const out: Record<string, unknown> = {};
		if (typeof _schema !== "object" || _schema === null)
			return out;
		const props = (_schema as Record<string, unknown>)["properties"];
		if (typeof props !== "object" || props === null)
			return out;
		for (const [key, node] of Object.entries(props as Record<string, unknown>))
		{
			const fallback = typeof node === "object" && node !== null ? (node as Record<string, unknown>)["default"] : null;
			out[key] = _ctx.Settings.Get<unknown>(key, fallback ?? null);
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 주기 갱신을 앱 공용 틱에 얹는다. 화면이 안 보여도 울려야 하므로 WhenVisible은 쓰지 않는다.
	// TickMs 설정이 바뀌면 다시 건다.
	// @param _ctx: 컨텍스트
	// @param _options: 설정 getter 묶음
	private RearmTimer(_ctx: IPluginContext, _options: IAlarmOptions): void
	{
		this.timer_?.Dispose();
		const engine = this.engine_;
		if (engine === null)
			return;
		const tickMs = Math.max(kMinTickMs, Math.round(_options.TickMs()));
		this.timer_ = _ctx.Schedule.Tick(() => engine.TickAsync(), { PeriodMs: tickMs });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 스키마를 읽어 둔다. 설정 오버레이를 열 때 PropertyGrid가 쓴다. 실패해도 무시.
	// @param _ctx: 컨텍스트
	private async LoadSchemaAsync(_ctx: IPluginContext): Promise<void>
	{
		try
		{
			const text = await _ctx.Fs.ReadText(`${_ctx.Paths.PluginDir}/Settings.schema.json`);
			this.schema_ = JSON.parse(text) as unknown;
		}
		catch
		{
			// 무시. 설정 화면만 비게 된다.
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 레시피를 리소스로 올린다. 실패해도 활성화를 막지 않는다.
	// @param _ctx: 컨텍스트
	private async RegisterRecipesAsync(_ctx: IPluginContext): Promise<void>
	{
		try
		{
			const text = await _ctx.Fs.ReadText(`${_ctx.Paths.PluginDir}/Recipes/InstantAlarm.md`);
			_ctx.Resources.Register("recipes/InstantAlarm", text, "text/markdown");
		}
		catch
		{
			// 무시.
		}
	}
}
