/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Renderer 부트스트랩 P3판. 10단계 중 Plugin·MCP(6·7 골격)·테마 고정CSS까지.
*/

import * as path from "node:path";
import "../../Scouter.Gui/Styles/Gui.css";
import "../../Scouter.Gui/Styles/Panels.css";
import "../../Scouter.Gui/Styles/Layers.css";
import "../../Scouter.Gui/Styles/Items.css";
import { Gui, UIManager, LoadContext, ButtonBase, HotReloader } from "@scouter/gui";
import * as GuiNs from "@scouter/gui";
import * as PluginApiNs from "@scouter/plugin-api";
import type { ICommandSource } from "@scouter/gui";
import { Log } from "./Services/Log";
import { Args } from "./Services/Args";
import { Paths } from "./Services/Paths";
import { Settings } from "./Services/Settings";
import { Hotkeys } from "./Services/Hotkeys";
import { CommandRegistry } from "./Services/CommandRegistry";
import { FileLogSink } from "./Services/FileLogSink";
import { GlobalHotkey } from "./Services/GlobalHotkey";
import { Shutdown } from "./Services/Shutdown";
import { ToastPolicy } from "./Services/ToastPolicy";
import { UpdateClient } from "./Services/UpdateClient";
import { SettingsSource } from "./Services/SettingsSource";
import { McpHttpServer } from "./Mcp/McpHttpServer";
import { TestApiServer } from "./TestApi/TestApiServer";
import { FsLayoutProvider } from "./Layout/FsLayoutProvider";
import { ChokidarWatcher } from "./Shell/ChokidarWatcher";
import { ThemeManager } from "./Theme/ThemeManager";
import { ApiShim } from "./Plugin/ApiShim";
import { PluginManager } from "./Plugin/PluginManager";
import { PluginWatcher } from "./Plugin/PluginWatcher";
import { ToastService } from "@scouter/gui";
import schema from "../Config/Settings.schema.json" with { type: "json" };
import defaults from "../Config/Defaults.json" with { type: "json" };
import "./Shell/ShellWindow";
import "./Shell/MessageBoxWindow";
import "./Shell/SettingsWindow";
import "./Shell/AboutWindow";
import "./Shell/ThemePickerWindow";
import "./Shell/WelcomeControl";
import "./Plugin/PermissionDialogWindow";
import "./Mcp/ApprovalDialogWindow";

class RegistryCommands implements ICommandSource
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// CommandRegistry로 실행한다.
	// @param _id: 명령 Id
	// @param _param: 파라미터
	public Execute(_id: string, _param?: string): void
	{
		void CommandRegistry.Execute(_id, _param);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 여부를 본다.
	// @param _id: 명령 Id
	public Has(_id: string): boolean
	{
		return CommandRegistry.CanExecute(_id);
	}
}

//////////////////////////////////////////////////////////////////////////////////////////
// Renderer 진입점. 단계 순서는 10 §10.7 부트스트랩 참조.
async function Main(): Promise<void>
{
	Args.Parse(process.argv);                                          // 1
	await Paths.Init();                                                // 1
	Log.SetSink(new FileLogSink(Paths.LogsDir));
	Log.Init({ Level: process.env["SCOUTER_LOG"] ?? "info" });
	Log.Info("App", "start");
	await Settings.Load(Paths.SettingsFile, schema, defaults); // 2
	ToastPolicy.Sync();
	await ThemeManager.InitAsync(`${Paths.ScouterHome}/themes`); // 3 동적 엔진 (P3 고정 CSS는 Gui.css 폴백)
	Gui.RegisterBuiltInElements();                                     // 4
	const root = document.getElementById("root");
	if (root === null)
		throw new Error("[Bootstrap] #root 없음");
	const layoutDirs = Args.LayoutDir ?? "Source/Scouter.App/Renderer/Layout";
	const builtInRoot = Paths.IsPackaged ? path.join(Paths.Resources, "PluginsBuiltIn") : "Source/Scouter.App/Renderer/BuiltIn";
	const userPlugins = `${Paths.ScouterHome}/plugins`;
	const exePlugins = Paths.ExePluginDir;
	const extraRoots = exePlugins !== null ? [builtInRoot, userPlugins, exePlugins] : [builtInRoot, userPlugins];
	const distDir = Paths.IsPackaged ? path.join(Paths.AppPath, "dist", "renderer") : "dist/renderer";
	const provider = new FsLayoutProvider({ LayoutDir: layoutDirs, UserDir: Paths.ScouterHome, DistDir: distDir, PluginDir: Args.PluginDir ?? (Paths.IsPackaged ? null : "Plugins"), ExtraPluginRoots: extraRoots });
	UIManager.Init(root, provider);                                    // 5
	UIManager.SetContextFactory(() =>
	{
		const ctx = new LoadContext();
		ctx.Settings = new SettingsSource();
		ctx.Commands = new RegistryCommands();
		return ctx;
	});
	if (UIManager.Root !== null)
		Hotkeys.Attach(UIManager.Root);
	ButtonBase.DefaultCommands = new RegistryCommands();
	const apiModules: Record<string, Record<string, unknown>> = {};
	apiModules["@scouter/gui"] = GuiNs;
	apiModules["@scouter/plugin-api"] = PluginApiNs;
	ApiShim.Register(apiModules);
	await ApiShim.InitAsync(`${Paths.Temp}/scouter-shims`);
	if (!Args.Safe)
	{
		await PluginManager.LoadAllAsync(builtInRoot);
		PluginWatcher.Start([builtInRoot, userPlugins, Args.PluginDir ?? "", exePlugins ?? ""].filter((_d) => _d.length > 0));
	}
	else
	{
		Log.Info("App", "safe mode: plugins skipped");
	}
	await McpHttpServer.StartAsync(Args.Port ?? Settings.Get<number>("Mcp.Port")); // 7
	await McpHttpServer.AttachMcpAsync(Paths.ScouterHome, Settings.Get<Array<{ Name: string; Transport: "stdio" | "http"; Command?: string; Args?: string[]; Url?: string; Headers?: Record<string, string>; Prefix: string }>>("Mcp.Upstreams", []));
	if (Args.IsTest)
		TestApiServer.Attach(McpHttpServer);                           // 8
	if (!Args.IsTest)
		GlobalHotkey.Sync();                                           // --test는 단일 인스턴스 예외라 전역 단축키를 잡지 않는다
	Shutdown.Arm();
	UpdateClient.Start();
	await UIManager.ShowAsync("Shell");                                // 9
	if (!Paths.IsPackaged && !Args.IsTest)
	{
		HotReloader.Start(provider, new ChokidarWatcher(), (_msg, _isError) => // 10
		{
			if (_isError)
				ToastService.Error(_msg);
			else
				ToastService.Info(_msg);
		});
	}
	Log.Info("Bootstrap", "ready");
}
void Main();
