/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Manifest·권한·번들러·컨텍스트 테스트.
*/

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { UIManager, Window, UserControl, ContentPresenter, MapLayoutProvider, RegisterWindow } from "@scouter/gui";
import { ManifestValidator } from "../../../Scouter.App/Renderer/Plugin/ManifestValidator";
import { PermissionStore } from "../../../Scouter.App/Renderer/Plugin/PermissionStore";
import { PluginBundler } from "../../../Scouter.App/Renderer/Plugin/PluginBundler";
import { PluginContext, PermissionError } from "../../../Scouter.App/Renderer/Plugin/PluginContext";
import { TickService } from "../../../Scouter.App/Renderer/Services/TickService";
import type { IPluginManifest } from "@scouter/plugin-api";
import * as path from "node:path";
import * as os from "node:os";

class AlarmWindow extends Window
{
}

class MenuWindow extends Window
{
}

@RegisterWindow("App/Own")
class AppWindow extends Window
{
}

function Manifest(): IPluginManifest
{
	return {
		Id: "Hello", Name: "Hello", Version: "0.1.0", Description: "", Author: "",
		Main: "Index.ts", Layout: "Layout/Main.xml", Icon: "", MinAppVersion: "0.4.0",
		Permissions: [], Tools: ["Echo"], Commands: ["Say"], Hotkeys: {},
	};
}

function SetupRoot(): HTMLElement
{
	UIManager.Reset();
	const root = document.createElement("div");
	document.body.append(root);
	UIManager.Init(root, new MapLayoutProvider());
	return root;
}

function MakeContext(): PluginContext
{
	const ctx = new PluginContext(Manifest(), {
		StorageDir: (_id) => `${os.tmpdir()}/scouter-${_id}`,
		HasPermission: (_id, _perm) => true,
		AppPlugins: () => [],
		AppVersion: () => "0.4.0",
	});
	ctx.InitPaths("/plug", "/store", "/user", "/tmp", "0.4.0");
	return ctx;
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

	void it("Ui.ShowDialog·ShowPopup은 {PluginId}/ 이름으로 연다", async () =>
	{
		const dom = SetupRoot();
		const ctx = MakeContext();
		ctx.Ui.RegisterWindow("Alarm", AlarmWindow);
		ctx.Ui.RegisterWindow("Menu", MenuWindow);
		const pending = ctx.Ui.ShowDialog<string>("Alarm");
		const dialog = UIManager.Find("Hello/Alarm");
		assert.ok(dialog instanceof AlarmWindow);
		assert.equal(UIManager.Active, dialog);
		const popup = ctx.Ui.ShowPopup("Menu");
		assert.ok(popup instanceof MenuWindow);
		assert.equal(UIManager.Find("Hello/Menu"), popup);
		assert.equal(ctx.Ui.ShowPopup("Hello/Menu") instanceof MenuWindow, true);
		UIManager.Close(dialog, "ok");
		assert.equal(await pending, "ok");
		ctx.Dispose();
		dom.remove();
		UIManager.Reset();
	});

	void it("Dispose는 자기 Plugin이 띄운 창만 닫는다", async () =>
	{
		const dom = SetupRoot();
		const appPending = UIManager.ShowDialog<string>("App/Own");
		const appWin = UIManager.Find("App/Own");
		assert.ok(appWin instanceof AppWindow);
		const ctx = MakeContext();
		ctx.Ui.RegisterWindow("Alarm", AlarmWindow);
		const pending = ctx.Ui.ShowDialog<string>("Alarm");
		const pluginWin = UIManager.Find("Hello/Alarm");
		assert.ok(pluginWin instanceof AlarmWindow);
		ctx.Dispose();
		assert.equal(await pending, undefined);
		assert.equal(pluginWin.IsClosed, true);
		assert.equal(appWin.IsClosed, false);
		assert.equal(appWin.Element.isConnected, true);
		ctx.Dispose();
		assert.equal(appWin.IsClosed, false);
		UIManager.Close(appWin, "app");
		assert.equal(await appPending, "app");
		dom.remove();
		UIManager.Reset();
	});

	void it("리로드(언로드→재로드)에도 모달이 남지 않는다", async () =>
	{
		const dom = SetupRoot();
		const first = MakeContext();
		first.Ui.RegisterWindow("Alarm", AlarmWindow);
		const firstPending = first.Ui.ShowDialog<string>("Alarm");
		const stale = UIManager.Find("Hello/Alarm");
		first.Dispose();
		assert.equal(await firstPending, undefined);
		const second = MakeContext();
		second.Ui.RegisterWindow("Alarm", AlarmWindow);
		const secondPending = second.Ui.ShowDialog<string>("Alarm");
		const fresh = UIManager.Find("Hello/Alarm");
		assert.notEqual(fresh, stale);
		second.Dispose();
		assert.equal(await secondPending, undefined);
		assert.equal(UIManager.Active, null);
		dom.remove();
		UIManager.Reset();
	});

	void it("Schedule.Tick은 공용 틱에 얹히고 언로드에서 정리된다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		const ctx = MakeContext();
		let count = 0;
		ctx.Schedule.Tick(() => { ++count; }, { PeriodMs: 1000 });
		assert.equal(TickService.CountOf("Hello"), 1);
		mock.timers.tick(1000);
		assert.equal(count, 1);
		ctx.Dispose();
		assert.equal(TickService.CountOf("Hello"), 0);
		assert.equal(TickService.IsRunning, false);
		mock.timers.tick(5000);
		assert.equal(count, 1);
		ctx.Dispose();
		TickService.Reset();
		mock.timers.reset();
	});

	void it("Tick(WhenVisible)은 그 Plugin 화면이 걸려 있을 때만 돈다", () =>
	{
		mock.timers.enable({ apis: ["setInterval"] });
		const dom = SetupRoot();
		const shell = UIManager.Show("Shell");
		const presenter = new ContentPresenter();
		presenter.Name = "content";
		shell.Content = presenter;
		const ctx = MakeContext();
		let count = 0;
		ctx.Schedule.Tick(() => { ++count; }, { PeriodMs: 1000, WhenVisible: true });
		mock.timers.tick(2000);
		assert.equal(count, 0);
		const view = new UserControl();
		view.PluginId = "Hello";
		presenter.Content = view;
		mock.timers.tick(1000);
		assert.equal(count, 1);
		presenter.Detach();
		mock.timers.tick(2000);
		assert.equal(count, 1);
		ctx.Dispose();
		TickService.Reset();
		dom.remove();
		UIManager.Reset();
		mock.timers.reset();
	});
});
