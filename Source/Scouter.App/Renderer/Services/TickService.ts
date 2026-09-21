/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: TickService. 앱 전체가 나눠 쓰는 공용 틱 1개. 구독자마다 주기·표시 조건을 따로 둔다.
*/

import type { IDisposable } from "@scouter/gui";
import { Log } from "./Log";

const kMinPeriodMs = 50;
const kDefaultPeriodMs = 1000;

export type TTickHandler = (_nowMs: number) => void | Promise<void>;

export interface ITickJobOptions
{
	PeriodMs?: number | undefined;
	Visible?: (() => boolean) | null | undefined;
}

interface ITickEntry
{
	Owner: string;
	Handler: TTickHandler;
	PeriodMs: number;
	Every: number;
	Counter: number;
	Visible: (() => boolean) | null;
	Running: boolean;
	Stopped: boolean;
}

export class TickService
{
	// ==================== 정적 ====================
	private static readonly s_entries_: ITickEntry[] = [];
	private static s_timer_: ReturnType<typeof setInterval> | null = null;
	private static s_basePeriodMs_ = 0;

	// ==================== 속성 ====================
	public static get IsRunning(): boolean { return TickService.s_timer_ !== null; }
	public static get Count(): number { return TickService.s_entries_.length; }
	public static get BasePeriodMs(): number { return TickService.s_basePeriodMs_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 공용 틱을 구독한다. 구독자가 몇이든 타이머는 1개뿐이고, 0명이 되면 멈춘다.
	// @param _owner: 소유자 (PluginId 등)
	// @param _handler: 콜백. 예외는 격리되고 Promise면 끝날 때까지 다음 틱을 건너뛴다
	// @param _opts: 주기(기본 1000ms) · 표시 조건(참일 때만 호출)
	public static Add(_owner: string, _handler: TTickHandler, _opts?: ITickJobOptions): IDisposable
	{
		const period = Math.max(kMinPeriodMs, Math.round(_opts?.PeriodMs ?? kDefaultPeriodMs));
		const entry: ITickEntry = {
			Owner: _owner,
			Handler: _handler,
			PeriodMs: period,
			Every: 1,
			Counter: 0,
			Visible: _opts?.Visible ?? null,
			Running: false,
			Stopped: false,
		};
		TickService.s_entries_.push(entry);
		TickService.Resync();
		return {
			Dispose: () =>
			{
				TickService.Cancel(entry);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 소유자 구독을 전부 끊는다. Plugin 언로드용.
	// @param _owner: 소유자
	public static RemoveAll(_owner: string): void
	{
		for (const entry of TickService.s_entries_.filter((_e) => _e.Owner === _owner))
			TickService.Cancel(entry);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 소유자가 붙잡고 있는 구독 수. 누수 진단·테스트용.
	// @param _owner: 소유자
	public static CountOf(_owner: string): number
	{
		return TickService.s_entries_.filter((_e) => _e.Owner === _owner).length;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 구독을 끊고 타이머를 멈춘다. 테스트 전용.
	public static Reset(): void
	{
		for (const entry of [...TickService.s_entries_])
			TickService.Cancel(entry);
		TickService.s_entries_.length = 0;
		TickService.Stop();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 구독 1개를 끊는다. 중복 호출은 조용히 넘긴다(멱등).
	// @param _entry: 구독
	private static Cancel(_entry: ITickEntry): void
	{
		if (_entry.Stopped)
			return;
		_entry.Stopped = true;
		const idx = TickService.s_entries_.indexOf(_entry);
		if (idx >= 0)
			TickService.s_entries_.splice(idx, 1);
		TickService.Resync();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기반 주기를 구독자 최소 주기로 다시 맞춘다. 구독이 없으면 타이머를 멈춘다.
	private static Resync(): void
	{
		if (TickService.s_entries_.length === 0)
		{
			TickService.Stop();
			return;
		}
		let base = Number.MAX_SAFE_INTEGER;
		for (const entry of TickService.s_entries_)
			base = Math.min(base, entry.PeriodMs);
		for (const entry of TickService.s_entries_)
		{
			const every = Math.max(1, Math.round(entry.PeriodMs / base));
			if (entry.Every === every)
				continue;
			entry.Every = every;
			entry.Counter = 0;
		}
		if (TickService.s_basePeriodMs_ === base && TickService.s_timer_ !== null)
			return;
		TickService.Stop();
		TickService.s_basePeriodMs_ = base;
		TickService.s_timer_ = setInterval(() =>
		{
			TickService.Pump(Date.now());
		}, base);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 타이머를 멈춘다. 이미 멈춰 있으면 아무것도 하지 않는다.
	private static Stop(): void
	{
		if (TickService.s_timer_ === null)
			return;
		clearInterval(TickService.s_timer_);
		TickService.s_timer_ = null;
		TickService.s_basePeriodMs_ = 0;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기반 틱 1회. 차례가 된 구독자만 부른다. 한 구독자가 터져도 나머지는 계속한다.
	// @param _nowMs: 현재 시각
	private static Pump(_nowMs: number): void
	{
		for (const entry of [...TickService.s_entries_])
		{
			if (entry.Stopped)
				continue;
			++entry.Counter;
			if (entry.Counter < entry.Every)
				continue;
			entry.Counter = 0;
			if (entry.Running)
				continue;
			if (entry.Visible !== null && !TickService.Ask(entry))
				continue;
			TickService.Fire(entry, _nowMs);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시 조건을 묻는다. 판정이 터지면 건너뛴다.
	// @param _entry: 구독
	private static Ask(_entry: ITickEntry): boolean
	{
		try
		{
			return _entry.Visible?.() ?? true;
		}
		catch (_e)
		{
			TickService.Report(_entry, _e);
			return false;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 핸들러를 부른다. Promise면 끝날 때까지 재진입을 막는다.
	// @param _entry: 구독
	// @param _nowMs: 현재 시각
	private static Fire(_entry: ITickEntry, _nowMs: number): void
	{
		_entry.Running = true;
		try
		{
			const back = _entry.Handler(_nowMs);
			if (!(back instanceof Promise))
			{
				_entry.Running = false;
				return;
			}
			void back.then(
				() => { _entry.Running = false; },
				(_e: unknown) =>
				{
					_entry.Running = false;
					TickService.Report(_entry, _e);
				});
		}
		catch (_e)
		{
			_entry.Running = false;
			TickService.Report(_entry, _e);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 구독자 예외를 남긴다. 틱 자체는 계속 돈다.
	// @param _entry: 구독
	// @param _error: 예외
	private static Report(_entry: ITickEntry, _error: unknown): void
	{
		Log.Warn("Tick", `구독자 예외: ${_entry.Owner}`, { error: String(_error) });
	}
}
