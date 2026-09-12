/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Window 생애주기·ESC·Closing 취소 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Window, ClosingEventArgs, KeyEventArgs, DataList } from "@scouter/gui";

class TestWindow extends Window
{
	public Log: string[] = [];
	public CloseRequested = 0;

	protected override OnInit(_data: DataList): void
	{
		this.Log.push("init");
	}

	protected override OnShown(): void
	{
		this.Log.push("shown");
	}

	protected override OnClosing(_args: ClosingEventArgs): void
	{
		this.Log.push("closing");
	}

	protected override OnClosed(): void
	{
		this.Log.push("closed");
	}

	protected override OnCloseRequested(): void
	{
		this.CloseRequested++;
	}
}

void describe("Window", () =>
{
	void it("Closing 취소하면 닫히지 않는다", () =>
	{
		const win = new TestWindow();
		win.InitForManager(new DataList());
		let cancelled = false;
		win.Closing.Add((_s, _a) => { _a.Cancel = true; cancelled = true; });
		assert.equal(win.NotifyClosing(), false);
		assert.equal(cancelled, true);
		assert.equal(win.NotifyClosing(), false);
		win.Dispose();
	});

	void it("수명 순서가 init→shown→closing→closed", () =>
	{
		const win = new TestWindow();
		win.InitForManager(new DataList());
		win.NotifyShown();
		assert.equal(win.NotifyClosing(), true);
		win.NotifyClosed();
		assert.deepEqual(win.Log, ["init", "shown", "closing", "closed"]);
		assert.equal(win.IsClosed, true);
		win.Dispose();
	});

	void it("ESC는 닫기 요청이다", () =>
	{
		const win = new TestWindow();
		win.PreviewKey(new KeyEventArgs(win, new KeyboardEvent("keydown", { key: "Escape" })));
		assert.equal(win.CloseRequested, 1);
		win.Dispose();
	});
});
