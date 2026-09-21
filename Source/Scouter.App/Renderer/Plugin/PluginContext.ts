/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PluginContext. IPluginContext 구현 + 권한 가드 + 해제 묶음.
*/

import * as path from "node:path";
import { DisposableBag } from "@scouter/gui";
import type { IDisposable, Window } from "@scouter/gui";
import { UIManager, ToastService, RegisterWindow, UserControl, DataList, WindowRegistry, ToastKind, ContentPresenter } from "@scouter/gui";
import type { IPluginContext, IPluginManifest, ITool, TNotifyKind, IMessageBoxOptions, TMessageBoxResult, TTickHandler, ITickOptions } from "@scouter/plugin-api";
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
import { TickService } from "../Services/TickService";
import type { ITickJobOptions } from "../Services/TickService";
import { GlobalToast } from "../Services/GlobalToast";
import { MessageBox } from "../Services/MessageBox";
import { ToolRegistry } from "./ToolRegistry";
import { ResourceRegistry } from "./ResourceRegistry";
import { PromptRegistry } from "./PromptRegistry";

const kShellWindow = "Shell";
const kShellContent = "content";

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
	private readonly windows_: string[] = [];
	private readonly opened_: Window[] = [];

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
	// 전 등록을 해제한다. Deactivate 시 호출. 두 번 불러도 안전하다.
	// 띄워 둔 Dialog·Popup을 가장 먼저 닫는다. 모달을 남기면 앱 전체가 잠긴다.
	public Dispose(): void
	{
		this.CloseOwned();
		ToolRegistry.RemoveAll(this.Manifest.Id);
		ResourceRegistry.RemoveAll(this.Manifest.Id);
		PromptRegistry.RemoveAll(this.Manifest.Id);
		Schedule.RemoveAll(this.Manifest.Id);
		TickService.RemoveAll(this.Manifest.Id);
		for (const name of this.windows_)
			WindowRegistry.Unregister(name);
		this.windows_.length = 0;
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
		Tick: (_handler: TTickHandler, _opts?: ITickOptions): IDisposable =>
		{
			const opts: ITickJobOptions = {};
			if (_opts?.PeriodMs !== undefined)
				opts.PeriodMs = _opts.PeriodMs;
			if (_opts?.WhenVisible === true)
				opts.Visible = (): boolean => PluginContext.IsViewVisible(this.Manifest.Id);
			const sub = TickService.Add(this.Manifest.Id, _handler, opts);
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
			const full = `${this.Manifest.Id}/${_name}`;
			RegisterWindow(full)(_ctor as new () => UserControl, {} as ClassDecoratorContext);
			this.windows_.push(full);
		},
		Show: (_name: string, _data?: unknown): unknown =>
		{
			const data = _data instanceof DataList ? _data : undefined;
			return UIManager.Show(_name, data);
		},
		ShowDialog: <T>(_name: string, _data?: unknown, _timeoutMs?: number): Promise<T> =>
		{
			const full = this.FullWindowName(_name);
			const data = _data instanceof DataList ? _data : undefined;
			const pending = UIManager.ShowDialog<T>(full, data, _timeoutMs ?? 0);
			this.Track(UIManager.Find(full));
			return pending;
		},
		ShowPopup: (_name: string, _data?: unknown): Window =>
		{
			const full = this.FullWindowName(_name);
			const data = _data instanceof DataList ? _data : undefined;
			const win = UIManager.ShowPopup(full, data);
			this.Track(win);
			return win;
		},
		Toast: (_msg: string): void => { ToastService.Info(`[${this.Manifest.Id}] ${_msg}`); },
		Notify: (_kind: TNotifyKind, _msg: string): void =>
		{
			if (_kind === "success")
				ToastService.Success(_msg);
			else if (_kind === "warn")
				ToastService.Warn(_msg);
			else if (_kind === "error")
				ToastService.Error(_msg);
			else
				ToastService.Info(_msg);
		},
		NotifyGlobal: (_kind: TNotifyKind, _title: string, _message?: string): Promise<boolean> =>
		{
			return GlobalToast.NotifyAsync({ Title: _title, Message: _message, Variant: PluginContext.ToastVariant(_kind) });
		},
		MessageBox: (_opts: IMessageBoxOptions): Promise<TMessageBoxResult> =>
		{
			return MessageBox.ShowAsync(_opts);
		},
		Confirm: (_msg: string): Promise<boolean> => Promise.resolve(window.confirm(_msg)),
	};

	public readonly App = {
		Version: "",
		Plugins: (): Array<{ Id: string; Name: string; Version: string; State: string }> => this.host_.AppPlugins(),
	};

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin 메인 화면이 지금 Shell 콘텐츠 영역에 걸려 있는지 본다. Tick(WhenVisible) 판정용.
	// Shell·콘텐츠 자리를 못 찾으면(테스트 등) 막지 않고 참으로 본다.
	// @param _id: Plugin Id
	private static IsViewVisible(_id: string): boolean
	{
		const shell = UIManager.Find(kShellWindow);
		if (shell === null)
			return true;
		const presenter = shell.FindName(ContentPresenter, kShellContent);
		if (presenter === null)
			return true;
		const content = presenter.Content;
		return content instanceof UserControl && content.PluginId === _id && content.IsLoaded && content.IsVisible;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창 이름에 Plugin Id를 붙인다. RegisterWindow와 같은 규칙. 이미 붙어 있으면 그대로 둔다.
	// @param _name: 등록 이름
	private FullWindowName(_name: string): string
	{
		const prefix = `${this.Manifest.Id}/`;
		return _name.startsWith(prefix) ? _name : `${prefix}${_name}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이 Plugin이 띄운 창을 기억한다. 이미 닫힌 창은 이 참에 목록에서 턴다.
	// @param _win: 창 (없으면 무시)
	private Track(_win: Window | null): void
	{
		for (let idx = this.opened_.length - 1; idx >= 0; --idx)
		{
			const win = this.opened_[idx];
			if (win === undefined || win === _win || win.IsClosed || !win.Element.isConnected)
				this.opened_.splice(idx, 1);
		}
		if (_win !== null)
			this.opened_.push(_win);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이 Plugin이 띄운 창만 골라 닫는다. 나중에 띄운 것부터. 다른 Plugin·앱 창은 건드리지 않는다.
	private CloseOwned(): void
	{
		const opened = [...this.opened_].reverse();
		this.opened_.length = 0;
		for (const win of opened)
		{
			if (win.IsClosed || !win.Element.isConnected)
				continue;
			try
			{
				if (!UIManager.Close(win, undefined))
					this.Logger.Warn(`창이 닫기를 거부했다: ${this.Manifest.Id}`);
			}
			catch (_e)
			{
				this.Logger.Warn(`창 정리 실패: ${String(_e)}`);
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 알림 종류를 ToastKind로 바꾼다.
	// @param _kind: 종류
	private static ToastVariant(_kind: TNotifyKind): ToastKind
	{
		if (_kind === "success")
			return ToastKind.Success;
		if (_kind === "warn")
			return ToastKind.Warn;
		if (_kind === "error")
			return ToastKind.Error;
		return ToastKind.Info;
	}

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
