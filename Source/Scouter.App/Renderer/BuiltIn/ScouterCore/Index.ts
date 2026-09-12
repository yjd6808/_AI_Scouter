/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ScouterCore 내장 Plugin. 설정 화면 + Tool 19개 + 리소스 + 프롬프트.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext, ITool } from "@scouter/plugin-api";
import { SettingsMainControl } from "./Views/SettingsMainControl";
import { ConnectView } from "./Views/ConnectView";
import { SettingsGetTool } from "./Tools/SettingsGet";
import { SettingsSetTool } from "./Tools/SettingsSet";
import { ThemeListTool } from "./Tools/ThemeList";
import { ThemeSetTool } from "./Tools/ThemeSet";
import { ThemeCreateTool } from "./Tools/ThemeCreate";
import { ThemeLintTool } from "./Tools/ThemeLint";
import { LayoutGetTool } from "./Tools/LayoutGet";
import { LayoutSetTool } from "./Tools/LayoutSet";
import { LayoutLintTool } from "./Tools/LayoutLint";
import { ControlCatalogTool } from "./Tools/ControlCatalog";
import { PluginListTool } from "./Tools/PluginList";
import { PluginReloadTool } from "./Tools/PluginReload";
import { PluginScaffoldTool } from "./Tools/PluginScaffold";
import { PluginLintTool } from "./Tools/PluginLint";
import { CommandListTool } from "./Tools/CommandList";
import { CommandExecuteTool } from "./Tools/CommandExecute";
import { LogQueryTool } from "./Tools/LogQuery";
import { ConnectSnippetTool } from "./Tools/ConnectSnippet";
import { ScreenshotTool } from "./Tools/Screenshot";
import { DocsResources } from "./Resources";
import { MakePluginPrompt } from "./MakePluginPrompt";

const kTools: Array<new () => ITool> = [
	SettingsGetTool, SettingsSetTool,
	ThemeListTool, ThemeSetTool, ThemeCreateTool, ThemeLintTool,
	LayoutGetTool, LayoutSetTool, LayoutLintTool, ControlCatalogTool,
	PluginListTool, PluginReloadTool, PluginScaffoldTool, PluginLintTool,
	CommandListTool, CommandExecuteTool, LogQueryTool, ConnectSnippetTool, ScreenshotTool,
];

export default class ScouterCorePlugin extends PluginBase
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 메인 화면·Tool·명령을 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		_ctx.Ui.RegisterWindow("Main", SettingsMainControl);
		_ctx.Ui.RegisterWindow("Connect", ConnectView);
		for (const ctor of kTools)
			_ctx.Tools.Register(new ctor());
		DocsResources.Register(_ctx);
		MakePluginPrompt.Register(_ctx);
		_ctx.Commands.Register("OpenSettings", {
			Title: "설정 열기",
			Run: () =>
			{
				_ctx.Ui.Show("Shell");
			},
		});
	}
}
