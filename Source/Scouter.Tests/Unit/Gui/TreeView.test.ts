/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: TreeView 펼침·지연 로드·키보드 테스트.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TreeView, TreeViewItem, KeyEventArgs } from "@scouter/gui";
import type { ITreeAdapter } from "@scouter/gui";

interface INode
{
	Name: string;
	Kids: INode[] | null;
}

function Adapter(): ITreeAdapter
{
	return {
		HeaderOf: (_n) => (_n as INode).Name,
		ChildrenOf: (_n) => (_n as INode).Kids,
		HasChildren: (_n) => (_n as INode).Kids !== null,
	};
}

function LazyAdapter(_loaded: INode[]): ITreeAdapter
{
	return {
		HeaderOf: (_n) => (_n as INode).Name,
		ChildrenOf: (_n) => (_loaded.includes(_n as INode) ? (_n as INode).Kids : null),
		HasChildren: (_n) => (_n as INode).Kids !== null,
	};
}

void describe("TreeView", () =>
{
	void it("펼침·접기로 행이 늘고 준다", () =>
	{
		const tree = new TreeView();
		const root: INode = { Name: "r", Kids: [{ Name: "a", Kids: [] }, { Name: "b", Kids: [] }] };
		tree.SetItems([root], Adapter());
		assert.equal(tree.Rows.length, 1);
		tree.KeyDown.Invoke(tree, new KeyEventArgs(tree, new KeyboardEvent("keydown", { key: "ArrowDown" })));
		tree.KeyDown.Invoke(tree, new KeyEventArgs(tree, new KeyboardEvent("keydown", { key: "ArrowRight" })));
		assert.equal(tree.Rows.length, 3);
		assert.ok(tree.Children[1] instanceof TreeViewItem);
		tree.KeyDown.Invoke(tree, new KeyEventArgs(tree, new KeyboardEvent("keydown", { key: "ArrowLeft" })));
		assert.equal(tree.Rows.length, 1);
	});

	void it("미로드는 Expanded에서 SetChildren으로 꽂는다", () =>
	{
		const tree = new TreeView();
		const loaded: INode[] = [];
		const root: INode = { Name: "r", Kids: [{ Name: "a", Kids: [] }] };
		tree.SetItems([root], LazyAdapter(loaded));
		let expanded = 0;
		tree.Expanded.Add(() =>
		{
			expanded++;
			loaded.push(root);
			tree.SetChildren(root, root.Kids ?? []);
		});
		tree.SelectNode(root);
		tree.KeyDown.Invoke(tree, new KeyEventArgs(tree, new KeyboardEvent("keydown", { key: "ArrowRight" })));
		assert.equal(expanded, 1);
		assert.equal(tree.Rows.length, 2);
	});

	void it("선택·깊이·aria가 따라간다", () =>
	{
		const tree = new TreeView();
		const root: INode = { Name: "r", Kids: [{ Name: "a", Kids: [{ Name: "leaf", Kids: [] }] }] };
		tree.SetItems([root], Adapter());
		let changed = 0;
		tree.SelectedItemChanged.Add(() => { changed++; });
		tree.SelectNode(root);
		tree.KeyDown.Invoke(tree, new KeyEventArgs(tree, new KeyboardEvent("keydown", { key: "ArrowRight" })));
		const second = tree.Children[1];
		assert.ok(second instanceof TreeViewItem);
		assert.equal(second.Depth, 1);
		assert.equal(second.Element.getAttribute("role"), "treeitem");
		tree.KeyDown.Invoke(tree, new KeyEventArgs(tree, new KeyboardEvent("keydown", { key: "ArrowDown" })));
		assert.equal((tree.SelectedItem as INode).Name, "a");
		assert.equal(changed, 2);
	});
});
