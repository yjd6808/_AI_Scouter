/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: @scouter/plugin-api 진입점. 타입 + PluginBase만.
*/

export type { ITool, IToolCall, IToolAnnotations } from "./ITool";
export type {
	IPluginContext, IPluginManifest, IContextSettings, IContextStorage, IContextSecrets,
	IContextLogger, IContextEvents, IContextTools, IContextResources, IContextPrompts,
	IContextCommands, IContextShell, IContextFs, IContextClipboard, IContextSchedule,
	IContextPaths, IContextUi, IContextApp,
} from "./IPluginContext";
export { PluginBase } from "./PluginBase";
