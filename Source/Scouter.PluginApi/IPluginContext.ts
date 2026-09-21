/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: IPluginContext. Plugin이 App을 만지는 유일한 창구(14.4).
*/

import type { IDisposable, Window } from "@scouter/gui";
import type { ITool } from "./ITool";

export interface IPluginManifest
{
	Id: string;
	Name: string;
	Version: string;
	Description: string;
	Author: string;
	Main: string;
	Layout: string;
	Icon: string;
	MinAppVersion: string;
	Permissions: string[];
	Settings?: string;
	Tools: string[];
	Commands: string[];
	Hotkeys: Record<string, string>;
}

export interface IContextSettings
{
	Get<T>(_key: string, _def: T): T;
	Set(_key: string, _value: unknown): void;
	On(_key: string, _handler: () => void): IDisposable;
}

export interface IContextStorage
{
	Get<T>(_key: string, _def: T): T;
	Set(_key: string, _value: unknown): void;
	Delete(_key: string): void;
}

export interface IContextSecrets
{
	Get(_key: string): Promise<string | null>;
	Set(_key: string, _value: string): Promise<void>;
	Delete(_key: string): Promise<void>;
}

export interface IContextLogger
{
	Debug(_msg: string, _data?: unknown): void;
	Info(_msg: string, _data?: unknown): void;
	Warn(_msg: string, _data?: unknown): void;
	Error(_msg: string, _data?: unknown): void;
}

export interface IContextEvents
{
	On(_name: string, _handler: (_args: unknown) => void): IDisposable;
	Emit(_name: string, _args: unknown): void;
}

export interface IContextTools
{
	Register(_tool: ITool): IDisposable;
	Invoke(_fullName: string, _args: Record<string, unknown>): Promise<unknown>;
}

export interface IContextResources
{
	Register(_uri: string, _text: string, _mimeType: string): IDisposable;
}

export interface IContextPrompts
{
	Register(_name: string, _def: { Description: string; Build(_args: Record<string, unknown>): string }): IDisposable;
}

export interface IContextCommands
{
	Register(_name: string, _def: { Title: string; Hotkey?: string; Run(_param?: unknown): void | Promise<void> }): IDisposable;
}

export interface IContextShell
{
	Exec(_cmd: string, _args: string[], _opts?: { TimeoutMs?: number; Env?: Record<string, string>; MaxOutputBytes?: number; Signal?: AbortSignal }): Promise<{ Code: number; Stdout: string; Stderr: string }>;
	SetStatus(_status: string, _text: string): void;
	SetBadge(_n: number): void;
}

export interface IContextFs
{
	ReadText(_path: string): Promise<string>;
	WriteText(_path: string, _text: string): Promise<void>;
	ReadDir(_path: string): Promise<string[]>;
	Exists(_path: string): Promise<boolean>;
}

export interface IContextClipboard
{
	ReadText(): string;
	WriteText(_text: string): boolean;
}

export type TTickHandler = (_nowMs: number) => void | Promise<void>;

export interface ITickOptions
{
	PeriodMs?: number | undefined;
	WhenVisible?: boolean | undefined;
}

export interface IContextSchedule
{
	Cron(_expr: string, _fn: () => void): IDisposable;
	Interval(_ms: number, _fn: () => void): IDisposable;
	Tick(_handler: TTickHandler, _opts?: ITickOptions): IDisposable;
}

export interface IContextPaths
{
	PluginDir: string;
	StorageDir: string;
	UserDataDir: string;
	Temp: string;
}

export type TNotifyKind = "info" | "success" | "warn" | "error";

export type TMessageBoxScope = "App" | "Global";
export type TMessageBoxKind = "ok" | "yesno";
export type TMessageBoxResult = "ok" | "yes" | "no" | "timeout" | "closed";

export interface IMessageBoxOptions
{
	Scope: TMessageBoxScope;
	Title: string;
	Message?: string | undefined;
	Kind?: TMessageBoxKind | undefined;
	DurationMs?: number | undefined;
	// Global이면 확인창 자체가 항상 위로, App이면 그동안 주 창을 핀한다. 기본 켜짐(Global 한정).
	Topmost?: boolean | undefined;
	// Global 표시와 함께 주 창을 앞으로 끌어온다. 기본 켜짐. 방해되면 false로 끈다.
	FocusMain?: boolean | undefined;
	OnResult?: ((_result: TMessageBoxResult) => void) | undefined;
}

export interface IContextUi
{
	RegisterWindow(_name: string, _ctor: new () => unknown): void;
	Show(_name: string, _data?: unknown): unknown;
	ShowDialog<T>(_name: string, _data?: unknown, _timeoutMs?: number): Promise<T>;
	ShowPopup(_name: string, _data?: unknown): Window;
	Toast(_msg: string): void;
	Notify(_kind: TNotifyKind, _msg: string): void;
	NotifyGlobal(_kind: TNotifyKind, _title: string, _message?: string): Promise<boolean>;
	MessageBox(_opts: IMessageBoxOptions): Promise<TMessageBoxResult>;
	Confirm(_msg: string): Promise<boolean>;
}

export interface IContextApp
{
	Version: string;
	Plugins(): Array<{ Id: string; Name: string; Version: string; State: string }>;
}

export interface IPluginContext
{
	Manifest: IPluginManifest;
	Settings: IContextSettings;
	Storage: IContextStorage;
	Secrets: IContextSecrets;
	Logger: IContextLogger;
	Events: IContextEvents;
	Tools: IContextTools;
	Resources: IContextResources;
	Prompts: IContextPrompts;
	Commands: IContextCommands;
	Hotkeys: { Bind(_gesture: string, _handler: () => void): IDisposable };
	Shell: IContextShell;
	Fs: IContextFs;
	Http: { Fetch(_url: string, _init?: RequestInit): Promise<Response> };
	Clipboard: IContextClipboard;
	Schedule: IContextSchedule;
	Worker: { Run<T>(_script: string, _args: unknown): Promise<T> };
	Paths: IContextPaths;
	Ui: IContextUi;
	App: IContextApp;
}
