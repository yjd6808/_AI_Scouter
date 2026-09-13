/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: Plugin 변경 표시·와처 분류·사이드바 dot 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StackPanel } from "@scouter/gui";
import type { ShellWindow } from "../../../Scouter.App/Renderer/Shell/ShellWindow";
import { SidebarController } from "../../../Scouter.App/Renderer/Shell/SidebarController";
import { PluginManager } from "../../../Scouter.App/Renderer/Plugin/PluginManager";
import { PluginWatcher } from "../../../Scouter.App/Renderer/Plugin/PluginWatcher";

const kId = "TestNoticeProbe";

void describe("PluginNotice", () =>
{
	void it("Dirty 저장·조회·해제", () =>
	{
		try
		{
			assert.equal(PluginManager.NoticeOf(kId), null);
			PluginManager.MarkDirty(kId);
			assert.equal(PluginManager.NoticeOf(kId), "Dirty");
			PluginManager.MarkDirty(kId);
			assert.equal(PluginManager.NoticeOf(kId), "Dirty");
			PluginManager.ClearNotice(kId);
			assert.equal(PluginManager.NoticeOf(kId), null);
			PluginManager.ClearNotice(kId);
			assert.equal(PluginManager.NoticeOf(kId), null);
		}
		finally
		{
			PluginManager.ClearNotice(kId);
		}
	});

	void it("와처는 xml만 자동리로드, ts/json/css는 Dirty, 나머지는 무시", () =>
	{
		assert.equal(PluginWatcher.KindOf("Layout/Main.xml"), "Reload");
		assert.equal(PluginWatcher.KindOf("Views/MainControl.XML"), "Reload");
		assert.equal(PluginWatcher.KindOf("Index.ts"), "Dirty");
		assert.equal(PluginWatcher.KindOf("Tools/LogTool.ts"), "Dirty");
		assert.equal(PluginWatcher.KindOf("Plugin.json"), "Dirty");
		assert.equal(PluginWatcher.KindOf("Styles/Gui.css"), "Dirty");
		assert.equal(PluginWatcher.KindOf("Recipes/ControlLab.md"), "Ignore");
		assert.equal(PluginWatcher.KindOf("Assets/icon.png"), "Ignore");
		assert.equal(PluginWatcher.KindOf("README"), "Ignore");
	});

	void it("Dirty면 red dot, Error면 느낌표와 is-error", () =>
	{
		const list = new StackPanel();
		const shell = { Navigate: (_id: string): void => undefined } as unknown as ShellWindow;
		const controller = new SidebarController(list, shell);
		try
		{
			controller.Rebuild([{ Id: kId, Title: "Probe", Icon: "package", Source: "External", State: "Active" }]);
			const btn = controller.Find(kId);
			assert.notEqual(btn, null);
			assert.equal(btn?.Element.querySelector(".gui-navitem__dot"), null);
			PluginManager.MarkDirty(kId);
			controller.Rebuild([{ Id: kId, Title: "Probe", Icon: "package", Source: "External", State: "Active" }]);
			assert.notEqual(controller.Find(kId)?.Element.querySelector(".gui-navitem__dot"), null);
			assert.equal(controller.Find(kId)?.Element.querySelector(".gui-navitem__alert"), null);
		}
		finally
		{
			PluginManager.ClearNotice(kId);
			list.Dispose();
		}
	});

	void it("우클릭 메뉴에 다시 로드 항목이 있다", () =>
	{
		const list = new StackPanel();
		const shell = { Navigate: (_id: string): void => undefined } as unknown as ShellWindow;
		const controller = new SidebarController(list, shell);
		try
		{
			controller.Rebuild([{ Id: kId, Title: "Probe", Icon: "package", Source: "External", State: "Active" }]);
			const btn = controller.Find(kId);
			assert.notEqual(btn?.ContextMenu, null);
		}
		finally
		{
			list.Dispose();
		}
	});
});
