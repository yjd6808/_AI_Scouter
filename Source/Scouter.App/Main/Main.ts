/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Main 프로세스 진입점. 인자·단일 인스턴스 후 AppHost로 넘긴다.
*/

import { app } from "electron";
import * as path from "node:path";
import { LaunchArgs } from "./LaunchArgs";
import { AppHost } from "./AppHost";
import { MainWindow } from "./MainWindow";

const args = LaunchArgs.Parse(process.argv);
// -multi는 프로필 미지정 시 "multi" 프로필로 userData를 분리한다.
const profile = args.Profile ?? (args.Multi ? "multi" : null);
if (args.Test)
{
	app.setPath("userData", `${app.getPath("temp")}/scouter-test-${process.pid}`);
}
else if (profile !== null)
{
	// 프로필 인스턴스: userData를 분리해 Chromium 프로필·설정 충돌 없이 다중 실행.
	const base = app.getPath("userData");
	app.setPath("userData", path.join(path.dirname(base), `${path.basename(base)}-${profile}`));
}

if (!app.requestSingleInstanceLock() && !args.Test && profile === null)
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
