/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: exe 기준 플러그인 폴더 결정 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { Paths } from "../../../Scouter.App/Renderer/Services/Paths";
import type { IAppPaths } from "../../../Scouter.App/Renderer/Services/Paths";

function Base(_over: Partial<IAppPaths>): IAppPaths
{
	return { UserData: "u", Home: "h", Exe: "", AppPath: "a", Resources: "r", Logs: "l", Temp: "t", Version: "0.4.0", IsPackaged: false, Args: [], ..._over };
}

void describe("PluginDirs", () =>
{
	void it("exe 기준 폴더를 굳힌다", () =>
	{
		try
		{
			Paths.Inject(Base({ Exe: "" }));
			assert.equal(Paths.ExeDir, "");
			assert.equal(Paths.ExePluginDir, null);
			Paths.Inject(Base({ Exe: path.join("C:", "app", "Scouter.exe"), IsPackaged: false }));
			assert.equal(Paths.ExePluginDir, null);
			Paths.Inject(Base({ Exe: path.join("C:", "app", "Scouter.exe"), IsPackaged: true }));
			assert.equal(Paths.ExeDir, path.join("C:", "app"));
			assert.equal(Paths.ExePluginDir, path.join("C:", "app", "Plugins"));
			Paths.Inject(Base({ Exe: "", IsPackaged: true }));
			assert.equal(Paths.ExePluginDir, null);
			Paths.Inject(Base({ Resources: "res", IsPackaged: true }));
			assert.equal(Paths.Resources, "res");
		}
		finally
		{
			Paths.Inject(Base({}));
		}
	});
});
