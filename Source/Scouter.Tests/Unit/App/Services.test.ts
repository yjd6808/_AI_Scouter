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
import { ToastPolicy } from "../../../Scouter.App/Renderer/Services/ToastPolicy";
import { GlobalToast } from "../../../Scouter.App/Renderer/Services/GlobalToast";
import { UIManager } from "@scouter/gui";
import { EventBus } from "../../../Scouter.App/Renderer/Services/EventBus";
import { CommandRegistry } from "../../../Scouter.App/Renderer/Services/CommandRegistry";
import { Hotkeys } from "../../../Scouter.App/Renderer/Services/Hotkeys";
import schema from "../../../Scouter.App/Config/Settings.schema.json" with { type: "json" };
import defaults from "../../../Scouter.App/Config/Defaults.json" with { type: "json" };

void describe("Services", () =>
{
	const file = `${process.env["TEMP"] ?? "/tmp"}/scouter-test-settings-${process.pid}.json`;
	after(async () =>
	{
		await Settings.FlushAsync();
		await unlink(file).catch(() => undefined);
		await unlink(`${file}.tmp`).catch(() => undefined);
	});

	void it("Settings 기본값·검증·Changed", async () =>
	{
		await unlink(file).catch(() => undefined);
		await Settings.Load(file, schema, defaults);
		assert.equal(Settings.Get<number>("Ui.SidebarWidth"), 225);
		let changed = "";
		Settings.Changed.Add((_c) => { changed = _c.Key; });
		Settings.Set("Ui.SidebarWidth", 220);
		assert.equal(changed, "Ui.SidebarWidth");
		assert.throws(() => { Settings.Set("Ui.SidebarWidth", 9999); });
		assert.equal(Settings.Get<number>("Ui.SidebarWidth"), 220);
		assert.equal(Settings.Has("Ui.SidebarWidth"), true);
	});

	void it("ToastPolicy 인앱·바탕화면 시간을 나눈다", () =>
	{
		ToastPolicy.Sync();
		Settings.Set("Ui.AppToastDurationSec", 7);
		assert.equal(UIManager.DefaultToastDurationMs, 7000);
		assert.equal(ToastPolicy.GlobalDurationMs, 4000);
		Settings.Set("Ui.GlobalToastDurationSec", 9);
		assert.equal(UIManager.DefaultToastDurationMs, 7000);
		assert.equal(ToastPolicy.GlobalDurationMs, 9000);
		Settings.Set("Ui.AppToastDurationSec", 0);
		assert.equal(UIManager.DefaultToastDurationMs, 0);
		Settings.Set("Ui.AppToastDurationSec", 4);
		Settings.Set("Ui.GlobalToastDurationSec", 4);
		assert.equal(UIManager.DefaultToastDurationMs, 4000);
		assert.equal(ToastPolicy.GlobalDurationMs, 4000);
	});

	void it("GlobalToast는 Main 없으면 false", async () =>
	{
		assert.equal(await GlobalToast.NotifyAsync({ Title: "x" }), false);
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
