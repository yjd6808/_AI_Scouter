/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScriptRunner 공용 타입. 스크립트 항목·인자·예약·실행 기록과 엔진·실행기 주입 계약.
*/

export type TScheduleKind = "After" | "At";
export type TRunTrigger = "Manual" | "Schedule" | "Mcp";
export type TRunResult = "Running" | "Success" | "Failed" | "Stopped" | "Error";
export type TEntryState = "Idle" | "Scheduled" | "Running";

export interface IScriptArg
{
	Name: string;
	Required: boolean;
	Value: string;
}

export interface IArgPreset
{
	Name: string;
	Values: Record<string, string>;
}

export interface IScriptSchedule
{
	Enabled: boolean;
	Kind: TScheduleKind;
	OffsetSec: number;
	AtTime: string;
	Repeat: boolean;
}

export interface IRunRecord
{
	RunId: string;
	Trigger: TRunTrigger;
	StartedAtMs: number;
	EndedAtMs: number;
	ExitCode: number;
	Result: TRunResult;
	Args: string[];
	Error: string;
}

export interface IScriptEntry
{
	Id: string;
	Title: string;
	Path: string;
	Args: IScriptArg[];
	Schedule: IScriptSchedule;
	KeepAfterBoot: boolean;
	Presets: IArgPreset[];
	SelectedPreset: string;
	NextDueAtMs: number;
	MissedAtMs: number;
	CreatedAtMs: number;
	UpdatedAtMs: number;
	RunCount: number;
	LastRun: IRunRecord | null;
}

export interface IEntrySpec
{
	Title: string;
	Path: string;
	Args: IScriptArg[];
	Schedule: IScriptSchedule;
	KeepAfterBoot: boolean;
}

export type TArgValues = Record<string, string> | string[];

export interface IEntryPatch
{
	Title?: string | undefined;
	Path?: string | undefined;
	Args?: IScriptArg[] | undefined;
	Schedule?: IScriptSchedule | undefined;
	KeepAfterBoot?: boolean | undefined;
	ArgValues?: TArgValues | undefined;
}

export interface IPersistState
{
	SchemaVersion: 1;
	Seq: number;
	BootMarkMs: number;
	Entries: IScriptEntry[];
}

export interface IScriptStorage
{
	Get<T>(_key: string, _def: T): T;
	Set(_key: string, _value: unknown): void;
	Delete(_key: string): void;
}

export interface INowSource
{
	Now(): number;
}

export interface IRunnerLogger
{
	Info(_msg: string, _data?: unknown): void;
	Warn(_msg: string, _data?: unknown): void;
}

export interface IShellExec
{
	Exec(_cmd: string, _args: string[], _opts?: { TimeoutMs?: number; Env?: Record<string, string>; MaxOutputBytes?: number; Signal?: AbortSignal }): Promise<{ Code: number; Stdout: string; Stderr: string }>;
}

export interface ITextFs
{
	ReadText(_path: string): Promise<string>;
	WriteText(_path: string, _text: string): Promise<void>;
}

export interface ILauncherOptions
{
	PythonExe(): string;
	NodeExe(): string;
	MaxLogKB(): number;
}

export interface ILaunchRequest
{
	EntryId: string;
	RunToken: string;
	Path: string;
	Args: string[];
	Signal: AbortSignal;
}

export interface ILaunchResult
{
	Code: number;
	Stdout: string;
	Stderr: string;
}

export interface IScriptLauncher
{
	LaunchAsync(_req: ILaunchRequest): Promise<ILaunchResult>;
	KillAsync(_entryId: string, _runToken: string): Promise<boolean>;
	ReadLogAsync(_entryId: string): Promise<string>;
	ResetLogAsync(_entryId: string): Promise<void>;
	QueryBootMarkAsync(): Promise<number | null>;
}

export type TRunEvent =
	| { Kind: "Started"; EntryId: string; Title: string; Record: IRunRecord }
	| { Kind: "Finished"; EntryId: string; Title: string; Record: IRunRecord }
	| { Kind: "Notice"; EntryId: string; Title: string; Text: string };

export interface IRunLogLine
{
	Ts: number;
	EntryId: string;
	Title: string;
	Text: string;
}

export interface IRunLogOptions
{
	MaxLines(): number;
}

export type TRunLogListener = (_added: IRunLogLine[], _reset: boolean) => void;

export type TDueOutcome =
	| { Ok: true; DueAtMs: number }
	| { Ok: false; Error: string };

export type TEntryOutcome =
	| { Ok: true; Entry: IScriptEntry }
	| { Ok: false; Error: string };

export type TRunOutcome =
	| { Ok: true; RunId: string; Done: Promise<IRunRecord> }
	| { Ok: false; Error: string };

export type TSpecOutcome =
	| { Ok: true; Spec: IEntrySpec }
	| { Ok: false; Error: string };

export type TPatchOutcome =
	| { Ok: true; Patch: IEntryPatch }
	| { Ok: false; Error: string };

export interface IRestoreReport
{
	Missed: IScriptEntry[];
	Advanced: number;
	Interrupted: number;
	Rebooted: boolean;
	ClearedByBoot: IScriptEntry[];
}

export interface IOutputSnapshot
{
	Text: string;
	TotalChars: number;
	Truncated: boolean;
}

export type TMissedSink = (_missed: IScriptEntry[]) => void;

export interface IRunnerViewPorts
{
	Tick(_handler: (_nowMs: number) => void): () => void;
	Confirm(_message: string): Promise<boolean>;
	Alert(_title: string, _message: string): void;
}
