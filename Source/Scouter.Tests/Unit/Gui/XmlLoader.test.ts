/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: XmlLoader 로드·바인딩·오류 코드 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { XmlLoader, LoadContext, BindingGraph, Window, StackPanel, Grid, UIElement } from "@scouter/gui";

class HostWindow extends Window
{
}

function Ctx(): LoadContext
{
	const ctx = new LoadContext();
	ctx.Graph = new BindingGraph();
	return ctx;
}

const kSample = `<?xml version="1.0" encoding="UTF-8"?>
<Window xmlns="scouter/gui" Name="channel_select" Title="채널 선택">
	<DataList>
		<Data Key="pageCur" Type="Int" Value="1"/>
		<Data Key="pageMax" Type="Int" Value="1"/>
		<Data Key="isRunning" Type="Bool" Value="false"/>
	</DataList>
	<Grid ContentHost="true" RowDefinitions="Auto,*">
		<StackPanel Grid.Row="0" Name="server_list" />
		<StackPanel Grid.Row="1" Name="channel_list" />
	</Grid>
</Window>`;

void describe("XmlLoader", () =>
{
	void it("샘플 로드·초기 바인딩", async () =>
	{
		const host = new HostWindow();
		const ctx = Ctx();
		const result = XmlLoader.LoadWindowInto(host, kSample, ctx);
		assert.equal(result.Ok, true);
		assert.equal(host.DataList.Get("pageCur"), 1);
		const found = host.FindName(StackPanel, "server_list");
		assert.notEqual(found, null);
		await new Promise((_resolve) => setTimeout(_resolve, 0));
		host.Dispose();
	});

	void it("DataList.Update가 microtask 1회로 번진다", async () =>
	{
		const host = new HostWindow();
		const ctx = Ctx();
		const xml = kSample.replace("Name=\"channel_list\" />", "Name=\"channel_list\" Opacity=\"{@pageCur}\" />");
		const result = XmlLoader.LoadWindowInto(host, xml, ctx);
		assert.equal(result.Ok, true);
		host.DataList.Update({ pageCur: 2 });
		await new Promise((_resolve) => setTimeout(_resolve, 0));
		const target = host.FindName(StackPanel, "channel_list") as StackPanel;
		assert.equal(target.Opacity, 2);
		host.Dispose();
	});

	void it("E코드별 실패", () =>
	{
		const badRoot = new HostWindow();
		const r1 = XmlLoader.LoadWindowInto(badRoot, "<Button/>", Ctx());
		assert.equal(r1.Ok, false);
		assert.equal(r1.Errors[0]?.Code, "E001");
		const badTag = new HostWindow();
		const r2 = XmlLoader.LoadWindowInto(badTag, "<Window><Nope/></Window>", Ctx());
		assert.equal(r2.Ok, false);
		assert.equal(r2.Errors[0]?.Code, "E010");
		const badProp = new HostWindow();
		const r3 = XmlLoader.LoadWindowInto(badProp, "<Window><Grid><StackPanel Nope=\"1\"/></Grid></Window>", Ctx());
		assert.equal(r3.Ok, false);
		assert.ok((r3.Errors[0]?.Code ?? "").startsWith("E011"));
		const badType = new HostWindow();
		const r4 = XmlLoader.LoadWindowInto(badType, "<Window><DataList><Data Key=\"a\" Type=\"_ptr\" Value=\"1\"/></DataList><Grid/></Window>", Ctx());
		assert.equal(r4.Ok, false);
		assert.equal(r4.Errors[0]?.Code, "E020");
		badRoot.Dispose();
		badTag.Dispose();
		badProp.Dispose();
		badType.Dispose();
	});

	void it("Grid 자식으로 붙는다", () =>
	{
		const host = new HostWindow();
		const result = XmlLoader.LoadWindowInto(host, kSample, Ctx());
		assert.equal(result.Ok, true);
		const grid = host.Children[0];
		assert.equal(grid instanceof Grid, true);
		assert.equal(grid?.Children.length, 2);
		assert.ok(host.FindName(UIElement, "channel_list") !== null);
		host.Dispose();
	});
});
