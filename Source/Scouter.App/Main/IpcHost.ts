/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: IpcHost. Main IPC 채널 등록. 창·앱·트레이·대화상자·테마.
*/

import { IpcChannels } from "../Shared/IpcChannels";
import type { ICaptureRect, IAttentionRequest } from "../Shared/IpcChannels";

export interface IIpcMain
{
	Handle(_channel: string, _fn: (..._args: unknown[]) => unknown): void;
}

export interface IMainWindowOps
{
	Minimize(): void;
	Maximize(): void;
	Unmaximize(): void;
	IsMaximized(): boolean;
	Close(): void;
	Hide(): void;
	Show(): void;
	Focus(): void;
	ToggleDevTools(): void;
	CapturePage(_rect?: ICaptureRect): Promise<{ Png: string }>;
	FlashFrame(_on: boolean): void;
	Send(_channel: string, ..._args: unknown[]): void;
	OnClose(_fn: () => void): void;
	OnMaximize(_fn: () => void): void;
	OnUnmaximize(_fn: () => void): void;
}

export interface IAppInfo
{
	UserData: string;
	Home: string;
	Exe: string;
	Resources: string;
	Logs: string;
	Temp: string;
	Version: string;
	IsPackaged: boolean;
	Args: string[];
}

export interface IAppOps
{
	Paths(): IAppInfo;
	SetAutoStart(_enabled: boolean): void;
	SetGlobalHotkey(_accelerator: string): boolean;
	CheckForUpdates(): Promise<void>;
	InstallUpdate(): void;
	Relaunch(): void;
	ShowItem(_path: string): void;
	OpenDialog(_opts: unknown): Promise<string | null>;
	SaveDialog(_opts: unknown): Promise<string | null>;
	SetTrayTooltip(_text: string): void;
	Notify(_title: string, _body: string): void;
	SystemDark(): boolean;
}

export class IpcHost
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 채널 핸들러를 등록한다.
	// @param _ipc: 등록자
	// @param _win: 창 조작
	// @param _app: 앱 조작
	public static Register(_ipc: IIpcMain, _win: IMainWindowOps, _app: IAppOps): void
	{
		_ipc.Handle(IpcChannels.WindowMinimize, () => { _win.Minimize(); });
		_ipc.Handle(IpcChannels.WindowMaximizeToggle, () =>
		{
			if (_win.IsMaximized())
				_win.Unmaximize();
			else
				_win.Maximize();
			return _win.IsMaximized();
		});
		_ipc.Handle(IpcChannels.WindowIsMaximized, () => _win.IsMaximized());
		_ipc.Handle(IpcChannels.WindowClose, () => { _win.Close(); });
		_ipc.Handle(IpcChannels.WindowHide, () => { _win.Hide(); });
		_ipc.Handle(IpcChannels.WindowToggleDevTools, () => { _win.ToggleDevTools(); });
		_ipc.Handle(IpcChannels.WindowAttention, (_payload) =>
		{
			const req = (_payload ?? {}) as IAttentionRequest;
			_win.FlashFrame(req.Flash ?? true);
			if (req.Notify !== undefined)
				_app.Notify(req.Notify.Title, req.Notify.Body);
		});
		_ipc.Handle(IpcChannels.AppGetPaths, () => _app.Paths());
		_ipc.Handle(IpcChannels.AppSetAutoStart, (_payload) =>
		{
			const enabled = ((_payload ?? {}) as { Enabled?: unknown }).Enabled === true;
			_app.SetAutoStart(enabled);
			return { Ok: true };
		});
		_ipc.Handle(IpcChannels.AppSetGlobalHotkey, (_payload) =>
		{
			const accelerator = IpcHost.Text(((_payload ?? {}) as { Accelerator?: unknown }).Accelerator);
			return { Ok: _app.SetGlobalHotkey(accelerator) };
		});
		_ipc.Handle(IpcChannels.AppRelaunch, () => { _app.Relaunch(); });
		_ipc.Handle(IpcChannels.AppUpdateCheck, () => { void _app.CheckForUpdates(); });
		_ipc.Handle(IpcChannels.AppUpdateInstall, () => { _app.InstallUpdate(); });
		_ipc.Handle(IpcChannels.AppCapturePage, (_payload) => _win.CapturePage((_payload ?? undefined) as ICaptureRect | undefined));
		_ipc.Handle(IpcChannels.AppShowItem, (_payload) =>
		{
			_app.ShowItem(IpcHost.Text(((_payload ?? {}) as { Path?: unknown }).Path));
		});
		_ipc.Handle(IpcChannels.DialogOpen, (_payload) => _app.OpenDialog(_payload));
		_ipc.Handle(IpcChannels.DialogSave, (_payload) => _app.SaveDialog(_payload));
		_ipc.Handle(IpcChannels.TraySetTooltip, (_payload) =>
		{
			_app.SetTrayTooltip(IpcHost.Text(((_payload ?? {}) as { Text?: unknown }).Text));
		});
		_win.OnMaximize(() => { _win.Send(IpcChannels.WindowMaximizedChanged, true); });
		_win.OnUnmaximize(() => { _win.Send(IpcChannels.WindowMaximizedChanged, false); });
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 문자열 페이로드를 굳힌다. 아니면 빈 문자열.
	// @param _value: 값
	private static Text(_value: unknown): string
	{
		return typeof _value === "string" ? _value : "";
	}
}
