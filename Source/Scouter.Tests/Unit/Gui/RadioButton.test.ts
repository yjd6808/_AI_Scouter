/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RadioButton 그룹 배타 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RadioButton, RadioGroupScope, StackPanel } from "@scouter/gui";

void describe("RadioButton", () =>
{
	void it("같은 그룹은 하나만 켜진다", () =>
	{
		const root = new StackPanel();
		document.body.append(root.Element);
		const a = new RadioButton();
		const b = new RadioButton();
		a.GroupName = "grp";
		b.GroupName = "grp";
		root.AddChild(a);
		root.AddChild(b);
		root.NotifyLoaded();
		a.IsChecked = true;
		b.IsChecked = true;
		RadioGroupScope.Select(b);
		assert.equal(a.IsChecked, false);
		assert.equal(b.IsChecked, true);
		root.Dispose();
	});
});
