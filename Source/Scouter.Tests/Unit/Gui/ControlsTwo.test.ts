/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: LogView·Popup·ToolTip 보충.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LogView, Popup, ToolTipService, StackPanel, UIManager, MapLayoutProvider } from "@scouter/gui";

void describe("ControlsTwo", () =>
{
	void it("LogView 추가·필터·복사", () =>
	{
		const view = new LogView();
		document.body.append(view.Element);
		view.Append({ Ts: Date.now(), Level: "info", Scope: "T", Msg: "hello" });
		view.Append({ Ts: Date.now(), Level: "error", Scope: "T", Msg: "boom" });
		view.SetValue(LogView.FilterProperty, "hello");
		assert.match(view.CopyAll(), /hello/);
		view.SetValue(LogView.FilterProperty, "");
		view.SetValue(LogView.LevelFilterProperty, "error");
		assert.match(view.CopyAll(), /boom/);
		view.AutoScroll = false;
		view.Append({ Ts: Date.now(), Level: "info", Scope: "T", Msg: "later" });
		view.Clear();
		assert.equal(view.CopyAll(), "");
		view.Dispose();
	});

	void it("Popup 열기·닫기·바깥 클릭", () =>
	{
		UIManager.Reset();
		const root = document.createElement("div");
		document.body.append(root);
		UIManager.Init(root, new MapLayoutProvider());
		const anchor = new StackPanel();
		document.body.append(anchor.Element);
		const popup = new Popup();
		popup.PlacementTarget = anchor;
		popup.StaysOpen = true;
		popup.IsOpen = true;
		assert.equal(document.querySelectorAll(".gui-popup").length, 1);
		popup.IsOpen = false;
		assert.equal(document.querySelectorAll(".gui-popup").length, 0);
		anchor.Dispose();
		popup.Dispose();
		root.remove();
		UIManager.Reset();
	});

	void it("ToolTip 빈 문자열은 예약 안 함", () =>
	{
		const anchor = new StackPanel();
		ToolTipService.Attach(anchor);
		anchor.ToolTip = "";
		anchor.Element.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
		anchor.Dispose();
	});
});
