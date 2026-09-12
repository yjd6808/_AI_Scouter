/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Host 커버리지 보충. UserControl 부착·다이얼로그 타임아웃·CloseAll.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIManager, Window, UserControl, MapLayoutProvider, WindowRegistry, UILayerKind, DataList } from "@scouter/gui";

class HostWindow extends Window
{
}

class TestView extends UserControl
{
	public AttachedLog: string[] = [];

	protected override OnAttached(_host: Window): void
	{
		this.AttachedLog.push("attached");
	}

	protected override OnDetached(): void
	{
		this.AttachedLog.push("detached");
	}
}

void describe("HostExtra", () =>
{
	void it("UserControl 부착·분리", () =>
	{
		const host = new HostWindow();
		const view = new TestView();
		view.AttachToManager(host, new DataList());
		assert.equal(view.Host, host);
		assert.deepEqual(view.AttachedLog, ["attached"]);
		view.DetachFromManager();
		assert.equal(view.Host, null);
		assert.deepEqual(view.AttachedLog, ["attached", "detached"]);
		host.Dispose();
		view.Dispose();
	});

	void it("ShowDialog 타임아웃은 닫힌다", async () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const pending = UIManager.ShowDialog<unknown>("Test/Timeout", undefined, 20);
		assert.equal(await pending, undefined);
		root.remove();
		UIManager.Reset();
	});

	void it("CloseAll 레이어 지정", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const win = UIManager.Show("Test/A");
		UIManager.CloseAll(UILayerKind.Base);
		assert.equal(win.IsClosed, true);
		UIManager.CloseAll();
		root.remove();
		UIManager.Reset();
	});

	void it("MapLayoutProvider 경로·감시", () =>
	{
		const provider = new MapLayoutProvider();
		provider.Add("A", "<Window/>");
		assert.equal(provider.PathOf("A"), "A");
		assert.equal(provider.PathOf("B"), null);
		assert.equal(provider.NameOf("A"), "A");
		assert.deepEqual(provider.WatchDirs(), []);
		assert.equal(Array.isArray(WindowRegistry.Names()), true);
	});
});
