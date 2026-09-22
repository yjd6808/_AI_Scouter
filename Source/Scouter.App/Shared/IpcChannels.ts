/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Main ↔ Renderer IPC 채널 상수 + 페이로드 타입.
*/

export const IpcChannels = {
	WindowMinimize: "window:minimize",
	WindowMaximizeToggle: "window:maximize-toggle",
	WindowClose: "window:close",
	WindowHide: "window:hide",
	WindowIsMaximized: "window:is-maximized",
	WindowMaximizedChanged: "window:maximized-changed",
	WindowToggleTopmost: "window:toggle-topmost",
	WindowSetTopmost: "window:set-topmost",
	WindowIsTopmost: "window:is-topmost",
	WindowTopmostChanged: "window:topmost-changed",
	WindowToggleDevTools: "window:toggle-devtools",
	WindowAttention: "window:attention",
	AppGetPaths: "app:get-paths",
	AppSetAutoStart: "app:set-auto-start",
	AppSetCloseToTray: "app:set-close-to-tray",
	AppSetGlobalHotkey: "app:set-global-hotkey",
	AppRelaunch: "app:relaunch",
	AppOpenSettings: "app:open-settings",
	AppUpdateCheck: "app:update-check",
	AppUpdateInstall: "app:update-install",
	AppUpdateStatus: "app:update-status",
	AppCapturePage: "app:capture-page",
	AppShowItem: "app:show-item",
	AppBeforeQuit: "app:before-quit",
	AppQuitReady: "app:quit-ready",
	TraySetTooltip: "tray:set-tooltip",
	DialogOpen: "dialog:open",
	DialogSave: "dialog:save",
	ThemeSystemChanged: "theme:system-changed",
	NotifyShow: "notify:show",
	NotifyReady: "notify:ready",
	NotifyPush: "notify:push",
	NotifyHeight: "notify:height",
	NotifyEmpty: "notify:empty",
	NotifyClick: "notify:click",
	MessageShow: "message:show",
	MessageReady: "message:ready",
	MessagePush: "message:push",
	MessageResult: "message:result",
	MessageHeight: "message:height",
	MessageClosed: "message:closed",
} as const;

export interface IUpdateStatus
{
	State: "idle" | "checking" | "downloading" | "ready" | "error";
	Version?: string;
	Percent?: number;
	Message?: string;
}

export interface ICaptureRect
{
	X: number;
	Y: number;
	Width: number;
	Height: number;
}

export interface IAttentionRequest
{
	Flash?: boolean;
	Foreground?: boolean;
	Notify?: { Title: string; Body: string };
}

export interface INotifyPush
{
	Id: number;
	Title: string;
	Message?: string;
	Variant: string;
	DurationMs: number;
	ThemeCss: string;
}

export interface IMessageShow
{
	Id: number;
	Title: string;
	Message?: string;
	Kind: string;
	DurationMs: number;
	Topmost: boolean;
	FocusMain: boolean;
	Flash: boolean;
	ThemeCss: string;
}
