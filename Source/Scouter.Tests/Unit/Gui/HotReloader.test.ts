/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: HotReloader 변경→재적재 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HotReloader, UIManager, MapLayoutProvider } from "@scouter/gui";
import type { IFileWatcher } from "@scouter/gui";

class FakeWatcher implements IFileWatcher
{
	public Handler: ((_path: string) => void) | null = null;

	public Watch(_dirs: string[], _onChange: (_path: string) => void): { Dispose(): void }
	{
		this.Handler = _onChange;
		return { Dispose: () => { this.Handler = null; } };
	}
}

void describe("HotReloader", () =>
{
	void it("change면 ReloadByLayout 후 토스트", async () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		const provider = new MapLayoutProvider();
		provider.Add("Hot/Main", "<Window><Grid><StackPanel Name=\"hot_list\"/></Grid></Window>");
		UIManager.Init(root, provider);
		await UIManager.ShowAsync("Hot/Main");
		const watcher = new FakeWatcher();
		const toasts: string[] = [];
		HotReloader.Start(provider, watcher, (_msg, _isError) =>
		{
			toasts.push(_msg);
		});
		watcher.Handler?.("Hot/Main");
		await new Promise((_resolve) => setTimeout(_resolve, 30));
		assert.equal(toasts.length, 1);
		HotReloader.Stop();
		root.remove();
		UIManager.Reset();
	});
});
