/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginContext. IPluginContext 구현 + 권한 가드 + 해제 묶음.
*/

import * as path from "node:path";
import { DisposableBag } from "@scouter/gui";
import type { IDisposable } from "@scouter/gui";
import { UIManager, ToastService, RegisterWindow, UserControl, DataList } from "@scouter/gui";
import type { IPluginContext, IPluginManifest, ITool } from "@scouter/plugin-api";
import { Settings } from "../Services/Settings";
import { Storage } from "../Services/Storage";
import { Secrets } from "../Services/Secrets";
import { Log } from "../Services/Log";
import { EventBus } from "../Services/EventBus";
import { CommandRegistry } from "../Services/CommandRegistry";
import { Hotkeys } from "../Services/Hotkeys";
import { Process } from "../Services/Process";
import { Fs } from "../Services/Fs";
import { Clipboard } from "../Services/Clipboard";
import { Schedule } from "../Services/Schedule";
import { ToolRegistry } from "./ToolRegistry";
import { ResourceRegistry } from "./ResourceRegistry";
import { PromptRegistry } from "./PromptRegistry";

export interface IPluginHost
{
	StorageDir(_id: string): string;
	HasPermission(_id: string, _perm: string): boolean;
	AppPlugins(): Array<{ Id: string; Name: string; Version: string; State: string }>;
	AppVersion(): string;
}

export class PermissionError extends Error
{
	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 권한 오류를 만든다.
	// @param _perm: 권한
	public constructor(_perm: string)
	{
		super(`[Plugin] 권한 없음: ${_perm}`);
	}
}

export class PluginContext implements IPluginContext
{
	// ==================== 멤버 ====================
	public readonly Manifest: IPluginManifest;
	private readonly host_: IPluginHost;
	private readonly bag_ = new DisposableBag();
	private readonly storage_: Storage;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 매니페스트·호스트로 만든다.
	// @param _manifest: 매니페스트
	// @param _host: 호스트
	public constructor(_manifest: IPluginManifest, _host: IPluginHost)
	{
		this.Manifest = _manifest;
		this.host_ = _host;
		this.storage_ = new Storage(path.join(_host.StorageDir(_manifest.Id), "storage.json"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 등록을 해제한다. Deactivate 시 호출.
	public Dispose(): void
	{
		ToolRegistry.RemoveAll(this.Manifest.Id);
		ResourceRegistry.RemoveAll(this.Manifest.Id);
		PromptRegistry.RemoveAll(this.Manifest.Id);
		Schedule.RemoveAll(this.Manifest.Id);
		this.bag_.Dispose();
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 권한을 요구한다. 없으면 PermissionError.
	// @param _perm: 권한
	public Require(_perm: string): void
	{
		if (!this.host_.HasPermission(this.Manifest.Id, _perm))
			throw new PermissionError(_perm);
	}

	// ==================== 서비스 ====================
	public readonly Settings = {
		Get: <T>(_key: string, _def: T): T => Settings.Get<T>(`Plugins.${this.Manifest.Id}.${_key}`, _def),
		Set: (_key: string, _value: unknown): void => { Settings.Set(`Plugins.${this.Manifest.Id}.${_key}`, _value); },
		On: (_key: string, _handler: () => void): IDisposable =>
		{
			const sub = Settings.Changed.Add((_change) =>
			{
				if (_change.Key === `Plugins.${this.Manifest.Id}.${_key}`)
					_handler();
			});
			this.bag_.Add(sub);
			return sub;
		},
	};

	public readonly Storage = {
		Get: <T>(_key: string, _def: T): T => this.storage_.Get(_key, _def),
		Set: (_key: string, _value: unknown): void => { this.storage_.Set(_key, _value); },
		Delete: (_key: string): void => { this.storage_.Delete(_key); },
	};

	public readonly Secrets = {
		Get: (_key: string): Promise<string | null> =>
		{
			this.Require("Secrets");
			return Secrets.GetAsync(`${this.Manifest.Id}.${_key}`);
		},
		Set: (_key: string, _value: string): Promise<void> =>
		{
			this.Require("Secrets");
			return Secrets.SetAsync(`${this.Manifest.Id}.${_key}`, _value);
		},
		Delete: (_key: string): Promise<void> =>
		{
			this.Require("Secrets");
			return Secrets.DeleteAsync(`${this.Manifest.Id}.${_key}`);
		},
	};

	public readonly Logger = {
		Debug: (_msg: string, _data?: unknown): void => { Log.Scope(`Plugin:${this.Manifest.Id}`).Debug(_msg, _data); },
		Info: (_msg: string, _data?: unknown): void => { Log.Scope(`Plugin:${this.Manifest.Id}`).Info(_msg, _data); },
		Warn: (_msg: string, _data?: unknown): void => { Log.Scope(`Plugin:${this.Manifest.Id}`).Warn(_msg, _data); },
		Error: (_msg: string, _data?: unknown): void => { Log.Scope(`Plugin:${this.Manifest.Id}`).Error(_msg, _data); },
	};

	public readonly Events = {
		On: (_name: string, _handler: (_args: unknown) => void): IDisposable =>
		{
			const sub = EventBus.Subscribe(_name, _handler);
			this.bag_.Add(sub);
			return sub;
		},
		Emit: (_name: string, _args: unknown): void =>
		{
			EventBus.Publish(`${this.Manifest.Id}.${_name}`, _args);
		},
	};

	public readonly Tools = {
		Register: (_tool: ITool): IDisposable =>
		{
			const sub = ToolRegistry.Register(this.Manifest.Id, _tool);
			this.bag_.Add(sub);
			return sub;
		},
		Invoke: (_fullName: string, _args: Record<string, unknown>): Promise<unknown> =>
		{
			this.Require("Tools.Invoke");
			const found = ToolRegistry.Find(_fullName);
			if (found === null)
				throw new Error(`[Plugin] Tool 없음: ${_fullName}`);
			return found.Tool.Run(_args, { SessionId: "plugin", Progress: () => undefined, Signal: new AbortController().signal, Log: (_msg) => { this.Logger.Info(_msg); } });
		},
	};

	public readonly Resources = {
		Register: (_uri: string, _text: string, _mimeType: string): IDisposable =>
		{
			const sub = ResourceRegistry.Register(this.Manifest.Id, _uri, _text, _mimeType);
			this.bag_.Add(sub);
			return sub;
		},
	};

	public readonly Prompts = {
		Register: (_name: string, _def: { Description: string; Build(_args: Record<string, unknown>): string }): IDisposable =>
		{
			const build = (_args: Record<string, unknown>): string => _def.Build(_args);
			const sub = PromptRegistry.Register(this.Manifest.Id, _name, _def.Description, build);
			this.bag_.Add(sub);
			return sub;
		},
	};

	public readonly Commands = {
		Register: (_name: string, _def: { Title: string; Hotkey?: string; Run(_param?: unknown): void | Promise<void> }): IDisposable =>
		{
			const full = `${this.Manifest.Id}.${_name}`;
			const run = (_param?: unknown): void | Promise<void> => _def.Run(_param);
			const def: { Id: string; Title: string; Category: string; Hotkey?: string; Execute: (_param?: unknown) => void | Promise<void> } =
				{ Id: full, Title: _def.Title, Category: this.Manifest.Id, Execute: run };
			if (_def.Hotkey !== undefined)
				def.Hotkey = _def.Hotkey;
			const sub = CommandRegistry.Register(def);
			this.bag_.Add(sub);
			if (_def.Hotkey !== undefined)
			{
				const hot = Hotkeys.Bind(_def.Hotkey, full);
				this.bag_.Add(hot);
			}
			return sub;
		},
	};

	public readonly Hotkeys = {
		Bind: (_gesture: string, _handler: () => void): IDisposable =>
		{
			const id = `${this.Manifest.Id}.Hotkey${this.bag_.Size}`;
			const sub = CommandRegistry.Register({ Id: id, Title: id, Category: this.Manifest.Id, Execute: _handler });
			this.bag_.Add(sub);
			const hot = Hotkeys.Bind(_gesture, id);
			this.bag_.Add(hot);
			return hot;
		},
	};

	public readonly Shell = {
		Exec: async (_cmd: string, _args: string[], _opts?: { TimeoutMs?: number; Env?: Record<string, string>; MaxOutputBytes?: number; Signal?: AbortSignal }): Promise<{ Code: number; Stdout: string; Stderr: string }> =>
		{
			this.Require("Process");
			const opts: { TimeoutMs?: number; Env?: Record<string, string>; MaxOutputBytes?: number; Signal?: AbortSignal } = {};
			if (_opts?.TimeoutMs !== undefined)
				opts.TimeoutMs = _opts.TimeoutMs;
			if (_opts?.Env !== undefined)
				opts.Env = _opts.Env;
			if (_opts?.MaxOutputBytes !== undefined)
				opts.MaxOutputBytes = _opts.MaxOutputBytes;
			if (_opts?.Signal !== undefined)
				opts.Signal = _opts.Signal;
			const result = await Process.Run(_cmd, _args, opts);
			return { Code: result.Code, Stdout: result.Stdout, Stderr: result.Stderr };
		},
		SetStatus: (_status: string, _text: string): void =>
		{
			EventBus.Publish("Scouter.SidebarStatus", { PluginId: this.Manifest.Id, Status: _status, Text: _text });
		},
		SetBadge: (_n: number): void =>
		{
			EventBus.Publish("Scouter.SidebarBadge", { PluginId: this.Manifest.Id, Count: _n });
		},
	};

	public readonly Fs = {
		ReadText: (_path: string): Promise<string> =>
		{
			this.CheckFs(_path, false);
			return Fs.ReadText(_path);
		},
		WriteText: (_path: string, _text: string): Promise<void> =>
		{
			this.CheckFs(_path, true);
			return Fs.WriteText(_path, _text);
		},
		ReadDir: (_path: string): Promise<string[]> =>
		{
			this.CheckFs(_path, false);
			return Fs.ReadDir(_path);
		},
		Exists: (_path: string): Promise<boolean> =>
		{
			this.CheckFs(_path, false);
			return Fs.Exists(_path);
		},
	};

	public readonly Http = {
		Fetch: (_url: string, _init?: RequestInit): Promise<Response> =>
		{
			this.Require("Network");
			return fetch(_url, _init);
		},
	};

	public readonly Clipboard = {
		ReadText: (): string =>
		{
			this.Require("Clipboard");
			return Clipboard.ReadText();
		},
		WriteText: (_text: string): boolean =>
		{
			this.Require("Clipboard");
			return Clipboard.WriteText(_text);
		},
	};

	public readonly Schedule = {
		Cron: (_expr: string, _fn: () => void): IDisposable =>
		{
			const sub = Schedule.Add(this.Manifest.Id, _expr, _fn);
			this.bag_.Add(sub);
			return sub;
		},
		Interval: (_ms: number, _fn: () => void): IDisposable =>
		{
			const sub = Schedule.Interval(this.Manifest.Id, _ms, _fn);
			this.bag_.Add(sub);
			return sub;
		},
	};

	public readonly Worker = {
		Run: <T>(_script: string, _args: unknown): Promise<T> =>
		{
			return new Promise((_resolve, _reject) =>
			{
				try
				{
					const url = URL.createObjectURL(new Blob([_script], { type: "text/javascript" }));
					const worker = new Worker(url);
					worker.onmessage = (_e) =>
					{
						worker.terminate();
						URL.revokeObjectURL(url);
						_resolve(_e.data as T);
					};
					worker.onerror = (_e) =>
					{
						worker.terminate();
						URL.revokeObjectURL(url);
						_reject(new Error(`[Plugin] worker 오류: ${_e.message}`));
					};
					worker.postMessage(_args);
				}
				catch (_e)
				{
					_reject(_e instanceof Error ? _e : new Error(String(_e)));
				}
			});
		},
	};

	public readonly Paths = {
		PluginDir: "",
		StorageDir: "",
		UserDataDir: "",
		Temp: "",
	};

	public readonly Ui = {
		RegisterWindow: (_name: string, _ctor: new () => unknown): void =>
		{
			RegisterWindow(`${this.Manifest.Id}/${_name}`)(_ctor as new () => UserControl, {} as ClassDecoratorContext);
		},
		Show: (_name: string, _data?: unknown): unknown =>
		{
			const data = _data instanceof DataList ? _data : undefined;
			return UIManager.Show(_name, data);
		},
		Toast: (_msg: string): void => { ToastService.Info(`[${this.Manifest.Id}] ${_msg}`); },
		Confirm: (_msg: string): Promise<boolean> => Promise.resolve(window.confirm(_msg)),
	};

	public readonly App = {
		Version: "",
		Plugins: (): Array<{ Id: string; Name: string; Version: string; State: string }> => this.host_.AppPlugins(),
	};

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 경로를 초기화한다. 매니저가 생성 직후 호출.
	// @param _pluginDir: Plugin 폴더
	// @param _storageDir: 저장 폴더
	// @param _userData: 사용자 데이터 폴더
	// @param _temp: 임시 폴더
	// @param _version: 앱 버전
	public InitPaths(_pluginDir: string, _storageDir: string, _userData: string, _temp: string, _version: string): void
	{
		this.Paths.PluginDir = _pluginDir;
		this.Paths.StorageDir = _storageDir;
		this.Paths.UserDataDir = _userData;
		this.Paths.Temp = _temp;
		this.App.Version = _version;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Fs 경로를 검사한다. 기본 허용 밖은 권한 필요.
	// @param _path: 경로
	// @param _write: 쓰기 여부
	private CheckFs(_path: string, _write: boolean): void
	{
		const norm = path.normalize(_path);
		const allowed = [path.normalize(this.Paths.PluginDir), path.normalize(this.Paths.StorageDir)];
		if (allowed.some((_base) => _base.length > 0 && (norm === _base || norm.startsWith(_base + path.sep))))
			return;
		this.Require(_write ? "Fs.Write" : "Fs.Read");
	}
}
