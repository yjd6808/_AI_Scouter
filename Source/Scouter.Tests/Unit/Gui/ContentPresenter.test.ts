/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ContentPresenter 분리·재부착 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ContentPresenter, Grid, UserControl } from "@scouter/gui";

class ViewA extends UserControl
{
}

class ViewB extends UserControl
{
}

void describe("ContentPresenter", () =>
{
	void it("Detach 후 요소가 살고 재부착된다", () =>
	{
		const presenter = new ContentPresenter();
		const a = new ViewA();
		const b = new ViewB();
		presenter.Content = a;
		assert.equal(presenter.Element.contains(a.Element), true);
		const detached = presenter.Detach();
		assert.equal(detached, a);
		assert.equal(presenter.Element.contains(a.Element), false);
		presenter.Content = b;
		presenter.Content = a;
		assert.equal(presenter.Element.contains(a.Element), true);
		presenter.Dispose();
		a.Dispose();
		b.Dispose();
	});

	void it("Grid 배치를 자식에 넘긴다", async () =>
	{
		const grid = new Grid();
		grid.SetValue(Grid.RowDefinitionsProperty, "Auto,*");
		grid.SetValue(Grid.ColumnDefinitionsProperty, "150,*");
		document.body.append(grid.Element);
		const presenter = new ContentPresenter();
		Grid.RowProperty.Set(presenter, 1);
		Grid.ColumnProperty.Set(presenter, 1);
		grid.AddChild(presenter);
		await new Promise((_resolve) => setTimeout(_resolve, 0));
		const view = new ViewA();
		presenter.Content = view;
		assert.equal(view.Element.style.gridRow, presenter.Element.style.gridRow);
		assert.equal(view.Element.style.gridColumn, presenter.Element.style.gridColumn);
		assert.ok(view.Element.style.gridRow.length > 0);
		grid.Dispose();
		view.Dispose();
	});
});
