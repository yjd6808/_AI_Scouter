/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Main 프로세스 진입점. 단일 인스턴스 + 창 생성 + IPC 등록만 한다.
*/

import { app } from "electron";
import { WindowFactory } from "./WindowFactory";
import { Ipc } from "./Ipc";
import { LaunchArgs } from "./LaunchArgs";

const args = LaunchArgs.Parse(process.argv);
if (args.Test)
	app.setPath("userData", `${app.getPath("temp")}/scouter-test-${process.pid}`);

if (!app.requestSingleInstanceLock() && !args.Test)
{
	app.quit();
}
else
{
	app.on("second-instance", () => { WindowFactory.Current?.show(); WindowFactory.Current?.focus(); });
	void app.whenReady().then(() =>
	{
		const win = WindowFactory.Create(args);
		Ipc.Register(win);
		if (!args.Hidden)
			win.show();
	});
	app.on("window-all-closed", () => { app.quit(); });
}
