/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Main ↔ Renderer IPC 계약 P0분. 창 제어 + 경로 조회만 등록한다.
*/

import { app, BrowserWindow, ipcMain } from "electron";

export class Ipc
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// IPC 핸들러를 등록한다.
	// @param _win: 주 창
	public static Register(_win: BrowserWindow): void
	{
		ipcMain.handle("window:minimize", () => { _win.minimize(); });
		ipcMain.handle("window:maximize-toggle", () =>
		{
			if (_win.isMaximized())
				_win.unmaximize();
			else
				_win.maximize();
			return _win.isMaximized();
		});
		ipcMain.handle("window:is-maximized", () => _win.isMaximized());
		ipcMain.handle("window:close", () => { _win.close(); });
		ipcMain.handle("app:get-paths", () => ({ UserData: app.getPath("userData"), Home: app.getPath("home"), Exe: app.getPath("exe"), Resources: process.resourcesPath, Logs: app.getPath("logs"), Temp: app.getPath("temp"), Version: app.getVersion(), IsPackaged: app.isPackaged, Args: process.argv }));
		ipcMain.handle("app:capture-page", async (_e, _rect?: { X: number; Y: number; Width: number; Height: number }) =>
		{
			const image = await _win.webContents.capturePage(_rect !== undefined ? { x: Math.round(_rect.X), y: Math.round(_rect.Y), width: Math.round(_rect.Width), height: Math.round(_rect.Height) } : undefined);
			return { Png: image.toPNG().toString("base64") };
		});
		_win.on("maximize", () => { _win.webContents.send("window:maximized-changed", true); });
		_win.on("unmaximize", () => { _win.webContents.send("window:maximized-changed", false); });
	}
}
