/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: InstantAlarm 공용 타입. 알람 스펙·예약 인스턴스·그룹·영속 상태와 엔진 주입 계약.
*/

export type TAlarmKind = "After" | "At";
export type TAlarmState = "Idle" | "Armed" | "Fired" | "Missed" | "Canceled";
export type TAlarmUiKind = "ok" | "yesno";
export type TAlarmResult = "ok" | "yes" | "no" | "timeout" | "closed" | "";
export type TMissedPolicy = "toast" | "silent";

export interface IAlarmSpec
{
	Id: string;
	Kind: TAlarmKind;
	Title: string;
	Message: string;
	OffsetSec: number;
	AtTime: string;
	RollToNextDay: boolean;
	KindUi: TAlarmUiKind;
	DurationSec: number;
	Topmost: boolean;
	WithToast: boolean;
}

export interface IArmedAlarm
{
	Id: string;
	SpecId: string;
	Spec: IAlarmSpec;
	GroupName: string;
	ArmedAtMs: number;
	DueAtMs: number;
	State: TAlarmState;
	FiredAtMs: number;
	Result: string;
	MissedNotified: boolean;
}

export interface IAlarmGroup
{
	Id: string;
	Name: string;
	Description: string;
	Specs: IAlarmSpec[];
}

export interface IPersistState
{
	SchemaVersion: 1;
	Armed: IArmedAlarm[];
	LastSeenAtMs: number;
}

export interface IAlarmStorage
{
	Get<T>(_key: string, _def: T): T;
	Set(_key: string, _value: unknown): void;
	Delete(_key: string): void;
}

export interface INowSource
{
	Now(): number;
}

export interface IAlarmLogger
{
	Info(_msg: string, _data?: unknown): void;
	Warn(_msg: string, _data?: unknown): void;
}

export interface IAlarmOptions
{
	DefaultDurationSec(): number;
	DefaultTopmost(): boolean;
	TickMs(): number;
	MissedPolicy(): TMissedPolicy;
	MissedGraceSec(): number;
	MissedListMax(): number;
	HistoryKeepDays(): number;
	UrgentSec(): number;
	DefaultGroup(): string;
}

export type TFireSink = (_alarm: IArmedAlarm) => Promise<TAlarmResult>;

export type TMissedSink = (_missed: IArmedAlarm[], _total: number) => void;

export type TDueOutcome =
	| { Ok: true; DueAtMs: number }
	| { Ok: false; Error: string };

export type TArmOutcome =
	| { Ok: true; Alarm: IArmedAlarm }
	| { Ok: false; Error: string };

export interface IGroupArmReport
{
	GroupName: string;
	Armed: IArmedAlarm[];
	Errors: string[];
}

export interface IRestoreReport
{
	Missed: IArmedAlarm[];
	Grace: IArmedAlarm[];
	ClockBack: boolean;
	Notified: number;
	Pruned: number;
}

export type TAlarmFilter = "All" | "Armed" | "Done" | "Missed";

export interface IAlarmViewPorts
{
	Tick(_handler: (_nowMs: number) => void): () => void;
	Preview(_spec: IAlarmSpec): void;
	Alert(_title: string, _message: string): void;
	SettingsSchema(): unknown;
	SettingsValues(): Record<string, unknown>;
	SettingsSet(_key: string, _value: unknown): void;
}
