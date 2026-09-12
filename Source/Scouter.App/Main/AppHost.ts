/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: AppHost. Main 기동 순서. 창·트레이·업데이트·종료를 묶는다.
*/

import * as fs from "node:fs";
import * as path from "node:path";
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, nativeTheme, Notification, shell } from "electron";
import { LaunchArgs } from "./LaunchArgs";
import { MainWindow } from "./MainWindow";
import { TrayController } from "./TrayController";
import { UpdateController } from "./UpdateController";
import { IpcHost } from "./IpcHost";
import type { IIpcMain, IMainWindowOps, IAppOps, IAppInfo } from "./IpcHost";
import { AutoStart } from "./AutoStart";
import type { ILoginSettings } from "./AutoStart";
import { CrashReporter } from "./CrashReporter";
import { MainLog } from "./MainLog";
import { IpcChannels } from "../Shared/IpcChannels";
import type { ICaptureRect } from "../Shared/IpcChannels";

function ReadSettings(_userData: string): Record<string, unknown>
{
	try
	{
		return JSON.parse(fs.readFileSync(path.join(_userData, ".scouter", "settings.json"), "utf-8")) as Record<string, unknown>;
	}
	catch
	{
		return {};
	}
}

function AppVersion(): string
{
	if (cachedVersion !== null)
		return cachedVersion;
	let version = "";
	try
	{
		const found = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")) as { version?: unknown };
		if (typeof found.version === "string")
			version = found.version;
	}
	catch
	{
		version = "";
	}
	if (version.length === 0)
		version = app.getVersion();
	cachedVersion = version;
	return version;
}

let cachedVersion: string | null = null;

function BoolOf(_root: Record<string, unknown>, _path: string, _def: boolean): boolean
{
	const parts = _path.split(".");
	let current: unknown = _root;
	for (const part of parts)
	{
		if (typeof current !== "object" || current === null)
			return _def;
		current = (current as Record<string, unknown>)[part];
	}
	return typeof current === "boolean" ? current : _def;
}

function SettingOf(_root: Record<string, unknown>, _path: string, _def: string): string
{
	const parts = _path.split(".");
	let current: unknown = _root;
	for (const part of parts)
	{
		if (typeof current !== "object" || current === null)
			return _def;
		current = (current as Record<string, unknown>)[part];
	}
	return typeof current === "string" ? current : _def;
}

export class AppHost
{
	// ==================== 정적 ====================
	private static s_quitting_ = false;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Main을 끝까지 기동한다. 단일 인스턴스·userData는 Main.ts 몫.
	// @param _args: 실행 인자
	public static StartAsync(_args: LaunchArgs): void
	{
		const userData = app.getPath("userData");
		const logsDir = path.join(userData, ".scouter", "logs");
		const log = new MainLog(logsDir);
		CrashReporter.Install(logsDir, () => []);
		log.Info("AppHost", `start v${app.getVersion()} packaged=${app.isPackaged}`);
		try
		{
			fs.mkdirSync(path.join(userData, ".scouter", "plugins"), { recursive: true });
		}
		catch
		{
			// 무시.
		}
		AppHost.SeedBundledPlugins();
		const win = MainWindow.Create(_args);
		const updater = new UpdateController((_status) => { win.webContents.send(IpcChannels.AppUpdateStatus, _status); });
		const ipc: IIpcMain = {
			Handle: (_channel: string, _fn: (..._args: unknown[]) => unknown) =>
			{
				ipcMain.handle(_channel, (_e: unknown, ..._a: unknown[]) => _fn(..._a));
			},
		};
		const login = {
			SetLoginItemSettings: (_opts: { openAtLogin: boolean; args: string[] }) => { app.setLoginItemSettings(_opts); },
			GetLoginItemSettings: () => app.getLoginItemSettings(),
		};
		const tray = new TrayController();
		if (!_args.Test)
		{
			const iconPath = path.join(process.resourcesPath, "Assets", "tray-16.png");
			tray.Create(iconPath, {
				OnOpen: () => { MainWindow.ToggleVisible(); },
				OnSettings: () =>
				{
					win.show();
					win.webContents.send(IpcChannels.AppOpenSettings);
				},
				OnCheckUpdate: () => { void updater.CheckAsync(); },
				OnQuit: () => { AppHost.Quit(); },
				StatusText: () => "Scouter",
			});
		}
		IpcHost.Register(ipc, AppHost.WindowOps(win, tray), AppHost.AppOps(win, tray, updater, log, login));
		nativeTheme.on("updated", () =>
		{
			win.webContents.send(IpcChannels.ThemeSystemChanged, { Dark: nativeTheme.shouldUseDarkColors });
		});
		app.on("window-all-closed", () =>
		{
			if (_args.Test)
				app.quit();
		});
		app.on("before-quit", (_e) =>
		{
			if (AppHost.s_quitting_)
				return;
			_e.preventDefault();
			win.webContents.send(IpcChannels.AppBeforeQuit);
			setTimeout(() =>
			{
				AppHost.Quit();
			}, 2000);
			ipcMain.once(IpcChannels.AppQuitReady, () => { AppHost.Quit(); });
		});
		const settings = ReadSettings(userData);
		if (BoolOf(settings, "App.AutoStart", false))
			AutoStart.Set(login, true);
		updater.Configure(SettingOf(settings, "App.Update.Channel", "stable"), SettingOf(settings, "App.Update.Url", ""));
		updater.Start(_args.Test);
		const startHidden = BoolOf(settings, "App.StartHidden", false);
		if (!_args.Hidden && !startHidden)
			win.show();
		log.Info("AppHost", "ready");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 종료 모드로 quit한다. 중복 호출 안전.
	private static Quit(): void
	{
		if (AppHost.s_quitting_)
			return;
		AppHost.s_quitting_ = true;
		MainWindow.SetQuitting();
		app.quit();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 번들 Plugin을 사용자 폴더에 심는다. 패키징 첫 실행만.
	private static SeedBundledPlugins(): void
	{
		if (!app.isPackaged)
			return;
		try
		{
			const from = path.join(process.resourcesPath, "Plugins", "P4Util");
			const to = path.join(app.getPath("userData"), ".scouter", "plugins", "P4Util");
			if (fs.existsSync(from) && !fs.existsSync(to))
				fs.cpSync(from, to, { recursive: true });
		}
		catch
		{
			// 무시.
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창 조작 묶음.
	// @param _win: 주 창
	// @param _tray: 트레이
	private static WindowOps(_win: BrowserWindow, _tray: TrayController): IMainWindowOps
	{
		return {
			Minimize: () => { _win.minimize(); },
			Maximize: () => { _win.maximize(); },
			Unmaximize: () => { _win.unmaximize(); },
			IsMaximized: () => _win.isMaximized(),
			Close: () => { _win.close(); },
			Hide: () => { _win.hide(); },
			Show: () => { _win.show(); },
			Focus: () => { _win.focus(); },
			ToggleDevTools: () => { _win.webContents.toggleDevTools(); },
			CapturePage: async (_rect?: ICaptureRect) =>
			{
				const image = await _win.webContents.capturePage(_rect !== undefined ? { x: Math.round(_rect.X), y: Math.round(_rect.Y), width: Math.round(_rect.Width), height: Math.round(_rect.Height) } : undefined);
				return { Png: image.toPNG().toString("base64") };
			},
			FlashFrame: (_on: boolean) => { _win.flashFrame(_on); },
			Send: (_channel: string, ..._args: unknown[]) => { _win.webContents.send(_channel, ..._args); },
			OnClose: (_fn: () => void) => { _win.on("close", _fn); },
			OnMaximize: (_fn: () => void) => { _win.on("maximize", _fn); },
			OnUnmaximize: (_fn: () => void) => { _win.on("unmaximize", _fn); },
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 앱 조작 묶음.
	// @param _win: 주 창
	// @param _tray: 트레이
	// @param _updater: 업데이터
	// @param _log: 로그
	private static AppOps(_win: BrowserWindow, _tray: TrayController, _updater: UpdateController, _log: MainLog, _login: ILoginSettings): IAppOps
	{
		return {
			Paths: (): IAppInfo => ({
				UserData: app.getPath("userData"), Home: app.getPath("home"), Exe: app.getPath("exe"),
				Resources: process.resourcesPath, Logs: app.getPath("logs"), Temp: app.getPath("temp"),
				Version: AppVersion(), IsPackaged: app.isPackaged, Args: process.argv,
			}),
			SetAutoStart: (_enabled: boolean) => { AutoStart.Set(_login, _enabled); },
			SetGlobalHotkey: (_accelerator: string) =>
			{
				globalShortcut.unregisterAll();
				if (_accelerator.length === 0)
					return true;
				try
				{
					return globalShortcut.register(_accelerator, () => { MainWindow.ToggleVisible(); });
				}
				catch
				{
					return false;
				}
			},
			CheckForUpdates: () => _updater.CheckAsync(),
			InstallUpdate: () => { _updater.Install(); },
			Relaunch: () => { app.relaunch(); app.exit(0); },
			ShowItem: (_path: string) => { shell.showItemInFolder(_path); },
			OpenDialog: async (_opts: unknown) =>
			{
				const result = await dialog.showOpenDialog(_win, (_opts ?? {}) as Electron.OpenDialogOptions);
				return result.canceled ? null : (result.filePaths[0] ?? null);
			},
			SaveDialog: async (_opts: unknown) =>
			{
				const result = await dialog.showSaveDialog(_win, (_opts ?? {}) as Electron.SaveDialogOptions);
				return result.canceled ? null : result.filePath;
			},
			SetTrayTooltip: (_text: string) => { _tray.SetTooltip(_text); },
			Notify: (_title: string, _body: string) =>
			{
				try
				{
					new Notification({ title: _title, body: _body }).show();
				}
				catch
				{
					_log.Warn("Notify", "표시 실패");
				}
			},
			SystemDark: () => nativeTheme.shouldUseDarkColors,
		};
	}
}
