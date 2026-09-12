/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UIManager Popup 레이어·창 닫기 배선 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UIManager, Window, MapLayoutProvider, RegisterWindow, UILayerKind } from "@scouter/gui";

@RegisterWindow("Test/Popup")
class PopupWindow extends Window
{
}

function SetupRoot(): { Dom: HTMLElement; Provider: MapLayoutProvider }
{
	UIManager.Reset();
	const dom = document.createElement("div");
	document.body.append(dom);
	const provider = new MapLayoutProvider();
	UIManager.Init(dom, provider);
	return { Dom: dom, Provider: provider };
}

void describe("UIManagerPopup", () =>
{
	void it("ShowPopup이면 Popup 레이어에 붙는다", () =>
	{
		const setup = SetupRoot();
		const win = UIManager.ShowPopup("Test/Popup");
		assert.ok(win instanceof PopupWindow);
		assert.equal(win.Layer, UILayerKind.Popup);
		assert.equal(UIManager.Find("Test/Popup"), win);
		assert.ok(setup.Dom.querySelector(".gui-layer[data-layer=\"Popup\"] .gui-window") !== null);
		UIManager.Close(win);
		setup.Dom.remove();
		UIManager.Reset();
	});

	void it("win.Close()면 UIManager에서 내려간다", () =>
	{
		const setup = SetupRoot();
		const win = UIManager.Show("Test/Popup");
		let closed = false;
		win.Closed.Add(() => { closed = true; });
		win.Close(undefined);
		assert.equal(closed, true);
		assert.equal(UIManager.Find("Test/Popup"), win);
		setup.Dom.remove();
		UIManager.Reset();
	});

	void it("ShowPopupAsync이면 XML을 읽어 올린다", async () =>
	{
		const setup = SetupRoot();
		setup.Provider.Add("Test/PopupXml", "<Window xmlns=\"scouter/gui\" Name=\"popup_xml\"><StackPanel><TextBlock Text=\"hi\" /></StackPanel></Window>");
		const win = await UIManager.ShowPopupAsync("Test/PopupXml");
		assert.equal(win.Layer, UILayerKind.Popup);
		assert.equal(win.Element.textContent, "hi");
		UIManager.Close(win);
		setup.Dom.remove();
		UIManager.Reset();
	});
});
