/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Manifest·권한·번들러·컨텍스트 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ManifestValidator } from "../../../Scouter.App/Renderer/Plugin/ManifestValidator";
import { PermissionStore } from "../../../Scouter.App/Renderer/Plugin/PermissionStore";
import { PluginBundler } from "../../../Scouter.App/Renderer/Plugin/PluginBundler";
import { PluginContext, PermissionError } from "../../../Scouter.App/Renderer/Plugin/PluginContext";
import type { IPluginManifest } from "@scouter/plugin-api";
import * as path from "node:path";
import * as os from "node:os";

function Manifest(): IPluginManifest
{
	return {
		Id: "Hello", Name: "Hello", Version: "0.1.0", Description: "", Author: "",
		Main: "Index.ts", Layout: "Layout/Main.xml", Icon: "", MinAppVersion: "0.4.0",
		Permissions: [], Tools: ["Echo"], Commands: ["Say"], Hotkeys: {},
	};
}

void describe("Plugin", () =>
{
	void it("Manifest 필수·패턴 검증", () =>
	{
		const ok = ManifestValidator.Validate({ Id: "Hello", Name: "H", Version: "0.1.0", Main: "Index.ts", Layout: "Layout/Main.xml" });
		assert.equal(ok.Id, "Hello");
		assert.throws(() => { ManifestValidator.Validate({ Id: "hello", Name: "H", Version: "0.1.0", Main: "I", Layout: "L" }); });
		assert.throws(() => { ManifestValidator.Validate({ Name: "H" }); });
	});

	void it("PermissionStore 저장·조회", async () =>
	{
		const file = path.join(os.tmpdir(), `scouter-perm-${process.pid}.json`);
		const store = new PermissionStore(file);
		assert.equal(await store.IsGranted("Hello", []), true);
		assert.equal(await store.IsGranted("Hello", ["Process"]), false);
		await store.GrantAsync("Hello", ["Process"], "0.1.0");
		assert.deepEqual(await store.Granted("Hello"), ["Process"]);
		assert.equal(await store.IsGranted("Hello", ["Process"]), true);
	});

	void it("Bundler 해시 캐시", async () =>
	{
		const dir = "Source/Scouter.Tests/Fixtures/Plugins/Hello";
		const first = await PluginBundler.BuildAsync(dir, Manifest());
		const second = await PluginBundler.BuildAsync(dir, Manifest());
		assert.equal(first, second);
	});

	void it("Context 접두·권한·해제", async () =>
	{
		const granted: string[] = [];
		const ctx = new PluginContext(Manifest(), {
			StorageDir: (_id) => `${os.tmpdir()}/scouter-${_id}`,
			HasPermission: (_id, _perm) => granted.includes(_perm),
			AppPlugins: () => [],
			AppVersion: () => "0.4.0",
		});
		ctx.InitPaths("/plug", "/store", "/user", "/tmp", "0.4.0");
		await assert.rejects(() => ctx.Shell.Exec("p4", []), PermissionError);
		assert.throws(() => { ctx.Require("Process"); });
		ctx.Dispose();
	});
});
