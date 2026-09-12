/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ScouterCore 카탈로그·스니펫·Tool 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SettingsCatalog } from "../../../Scouter.App/Renderer/BuiltIn/ScouterCore/SettingsCatalog";
import { ConnectSnippets } from "../../../Scouter.App/Renderer/BuiltIn/ScouterCore/ConnectSnippets";
import { SettingsGetTool } from "../../../Scouter.App/Renderer/BuiltIn/ScouterCore/Tools/SettingsGet";
import { ControlCatalogTool } from "../../../Scouter.App/Renderer/BuiltIn/ScouterCore/Tools/ControlCatalog";
import { CallLogBuffer } from "../../../Scouter.App/Renderer/BuiltIn/McpInspector/CallLogBuffer";
import { Settings } from "../../../Scouter.App/Renderer/Services/Settings";
import schema from "../../../Scouter.App/Config/Settings.schema.json" with { type: "json" };
import defaults from "../../../Scouter.App/Config/Defaults.json" with { type: "json" };
import { Gui } from "@scouter/gui";

void describe("ScouterCore", () =>
{
	void it("SettingsCatalog 병합", () =>
	{
		const cats = SettingsCatalog.Categories();
		assert.ok(cats.some((_c) => _c.Id === "Ui" && _c.Title === "일반"));
		assert.ok(cats.some((_c) => _c.Id === "Mcp"));
	});

	void it("ConnectSnippets 치환", async () =>
	{
		assert.ok((await ConnectSnippets.Clients()).includes("Claude Code"));
		const snippet = await ConnectSnippets.Render("Claude Code", "http://127.0.0.1:9515", "TOKEN");
		assert.match(snippet, /TOKEN/);
		await assert.rejects(ConnectSnippets.Render("없음", "u", "t"));
	});

	void it("SettingsGet 마스킹", async () =>
	{
		await Settings.Load(`${process.env["TEMP"] ?? "/tmp"}/scouter-core-${process.pid}.json`, schema, defaults);
		const tool = new SettingsGetTool();
		const masked = await tool.Run({ Path: "Mcp.Token" });
		assert.equal(masked, "(masked)");
		const port = await tool.Run({ Path: "Mcp.Port" });
		assert.equal(port, 9515);
	});

	void it("ControlCatalog 태그", async () =>
	{
		Gui.RegisterBuiltInElements();
		const tool = new ControlCatalogTool();
		const listed = await tool.Run({}) as { Tags: string[] };
		assert.ok(listed.Tags.includes("Grid"));
		const one = await tool.Run({ Tag: "Grid" }) as { Properties: Array<{ Name: string }> };
		assert.ok(one.Properties.length > 0);
	});

	void it("CallLogBuffer 순환·필터", () =>
	{
		CallLogBuffer.Clear();
		CallLogBuffer.Push({ Tool: "A__X", Ok: true });
		CallLogBuffer.Push({ Tool: "B__Y", Ok: false });
		assert.equal(CallLogBuffer.Snapshot("", false).length, 2);
		assert.equal(CallLogBuffer.Snapshot("", true).length, 1);
		assert.equal(CallLogBuffer.Snapshot("A__", false).length, 1);
		CallLogBuffer.Clear();
	});
});
