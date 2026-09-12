/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Plugin 통합. 실제 esbuild 번들 + import 경로 확인.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { PluginDiscovery } from "../../Scouter.App/Renderer/Plugin/PluginDiscovery";
import { ManifestValidator } from "../../Scouter.App/Renderer/Plugin/ManifestValidator";
import { PluginBundler } from "../../Scouter.App/Renderer/Plugin/PluginBundler";
import { readFileSync } from "node:fs";

void describe("PluginIntegration", () =>
{
	void it("Hello 발견·검증·번들·import", async () =>
	{
		const found = await PluginDiscovery.Scan([{ Dir: "Source/Scouter.Tests/Fixtures/Plugins", Source: "External" }]);
		assert.equal(found.length, 1);
		const dir = found[0]?.Dir ?? "";
		const manifest = ManifestValidator.Validate(JSON.parse(readFileSync(`${dir}/Plugin.json`, "utf-8")));
		assert.equal(manifest.Id, "Hello");
		const outFile = await PluginBundler.BuildAsync(dir, manifest);
		const mod = await import(pathToFileURL(outFile).href) as { default?: unknown };
		assert.equal(typeof mod.default, "function");
	});
});
