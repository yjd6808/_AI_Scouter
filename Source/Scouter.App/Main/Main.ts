/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Main 프로세스 진입점. 인자·단일 인스턴스 후 AppHost로 넘긴다.
*/

import { app } from "electron";
import { LaunchArgs } from "./LaunchArgs";
import { AppHost } from "./AppHost";
import { MainWindow } from "./MainWindow";

const args = LaunchArgs.Parse(process.argv);
if (args.Test)
	app.setPath("userData", `${app.getPath("temp")}/scouter-test-${process.pid}`);

if (!app.requestSingleInstanceLock() && !args.Test)
{
	app.quit();
}
else
{
	app.on("second-instance", () =>
	{
		MainWindow.Current?.show();
		MainWindow.Current?.focus();
	});
	void app.whenReady().then(() =>
	{
		AppHost.StartAsync(args);
	});
}
