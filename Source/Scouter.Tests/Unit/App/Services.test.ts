/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Settings·EventBus·Hotkeys·CommandRegistry 테스트.
*/

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { Settings } from "../../../Scouter.App/Renderer/Services/Settings";
import { EventBus } from "../../../Scouter.App/Renderer/Services/EventBus";
import { CommandRegistry } from "../../../Scouter.App/Renderer/Services/CommandRegistry";
import { Hotkeys } from "../../../Scouter.App/Renderer/Services/Hotkeys";
import schema from "../../../Scouter.App/Config/Settings.schema.json" with { type: "json" };
import defaults from "../../../Scouter.App/Config/Defaults.json" with { type: "json" };

void describe("Services", () =>
{
	const file = `${process.env["TEMP"] ?? "/tmp"}/scouter-test-settings-${process.pid}.json`;
	after(() =>
	{
		void unlink(file).catch(() => undefined);
	});

	void it("Settings 기본값·검증·Changed", async () =>
	{
		await Settings.Load(file, schema, defaults);
		assert.equal(Settings.Get<number>("Ui.SidebarWidth"), 150);
		let changed = "";
		Settings.Changed.Add((_c) => { changed = _c.Key; });
		Settings.Set("Ui.SidebarWidth", 220);
		assert.equal(changed, "Ui.SidebarWidth");
		assert.throws(() => { Settings.Set("Ui.SidebarWidth", 9999); });
		assert.equal(Settings.Get<number>("Ui.SidebarWidth"), 220);
		assert.equal(Settings.Has("Ui.SidebarWidth"), true);
	});

	void it("EventBus 와일드카드·해제", () =>
	{
		let count = 0;
		const sub = EventBus.Subscribe("P4Util.*", () => { count++; });
		EventBus.Publish("P4Util.Extracted", {});
		EventBus.Publish("Other.X", {});
		assert.equal(count, 1);
		sub.Dispose();
		EventBus.Publish("P4Util.Extracted", {});
		assert.equal(count, 1);
	});

	void it("CommandRegistry 중복·중단", async () =>
	{
		let ran = 0;
		const reg = CommandRegistry.Register({ Id: "Test.Hello", Title: "Hello", Category: "Test", Execute: () => { ran++; } });
		assert.throws(() => { CommandRegistry.Register({ Id: "Test.Hello", Title: "H", Category: "T", Execute: () => undefined }); });
		assert.equal(await CommandRegistry.Execute("Test.Hello"), true);
		assert.equal(ran, 1);
		assert.equal(await CommandRegistry.Execute("Test.없음"), false);
		reg.Dispose();
	});

	void it("Hotkeys 정규화", () =>
	{
		assert.equal(Hotkeys.Normalize("shift+ctrl+p"), "Ctrl+Shift+P");
		assert.equal(Hotkeys.Normalize("Ctrl+B"), "Ctrl+B");
	});
});
