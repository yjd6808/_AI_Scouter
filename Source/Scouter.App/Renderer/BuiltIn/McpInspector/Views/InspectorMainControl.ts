/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: InspectorMainControl. 세션·호출·직접호출 3탭.
*/

import { UserControl, TreeView, TabControl, ListView, VirtualList, TextBox, TextBlock, Button, StackPanel, DataList, CodeEditor } from "@scouter/gui";
import { McpHttpServer } from "../../../Mcp/McpHttpServer";
import { ToolRegistry } from "../../../Plugin/ToolRegistry";
import { CallLogBuffer } from "../CallLogBuffer";
import { CallPanel } from "./CallPanel";

interface IToolNode
{
	Kind: "group" | "tool";
	Name: string;
	FullName: string;
}

export class InspectorMainControl extends UserControl
{
	// ==================== 정적 ====================
	private static s_invoker_: ((_full: string, _args: Record<string, unknown>) => Promise<unknown>) | null = null;

	// ==================== 멤버 ====================
	private tools_!: TreeView;
	private sessions_!: ListView;
	private calls_!: VirtualList;
	private detail_!: CodeEditor;
	private callPanel_: CallPanel | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 호출기를 둔다. Index OnActivate에서 1회.
	// @param _invoker: 호출기
	public static SetInvoker(_invoker: (_full: string, _args: Record<string, unknown>) => Promise<unknown>): void
	{
		InspectorMainControl.s_invoker_ = _invoker;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 3탭을 묶는다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.tools_ = this.RequireName(TreeView, "tree_tools");
		this.sessions_ = this.RequireName(ListView, "lst_sessions");
		this.calls_ = this.RequireName(VirtualList, "log_calls");
		this.detail_ = this.RequireName(CodeEditor, "txt_detail");
		const tabs = this.RequireName(TabControl, "tab_main");
		this.sessions_.DisplayMemberPath = "Client";
		this.RebuildTools("");
		this.RefreshSessions();
		this.RefreshCalls();
		const filter = this.FindName(TextBox, "txt_filter");
		filter?.TextChanged.Add(() =>
		{
			this.RebuildTools(filter.Text);
		});
		tabs.SelectionChanged.Add(() =>
		{
			this.RefreshSessions();
			this.RefreshCalls();
		});
		const panel = this.FindName(StackPanel, "pnl_call");
		if (panel !== null)
		{
			this.callPanel_ = new CallPanel(panel, this.tools_);
			if (InspectorMainControl.s_invoker_ !== null)
				this.callPanel_.SetInvoker(InspectorMainControl.s_invoker_);
		}
		this.FindName(Button, "btn_audit")?.Click.Add(() =>
		{
			this.detail_.Text = "감사 로그: ~/.scouter/logs/mcp-audit.jsonl";
		});
		McpHttpServer.SessionsChanged.Add(() =>
		{
			this.RefreshSessions();
			_data.Set("sessionCount", McpHttpServer.SessionList().length);
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool 목록을 Plugin 그룹 트리로 다시 깐다.
	// @param _filter: 필터
	private RebuildTools(_filter: string): void
	{
		const query = _filter.toLowerCase();
		const groups = new Map<string, IToolNode[]>();
		for (const full of ToolRegistry.List().map((_t) => _t.FullName).filter((_n) => _n.toLowerCase().includes(query)).sort())
		{
			const cut = full.indexOf("__");
			const plugin = cut > 0 ? full.slice(0, cut) : "";
			const list = groups.get(plugin) ?? [];
			list.push({ Kind: "tool", Name: cut > 0 ? full.slice(cut + 2) : full, FullName: full });
			groups.set(plugin, list);
		}
		const roots: IToolNode[] = [...groups.keys()].map((_plugin) => ({ Kind: "group", Name: _plugin, FullName: "" }));
		this.tools_.SetItems(roots, {
			HeaderOf: (_n) => (_n as IToolNode).Name,
			ChildrenOf: (_n) =>
			{
				const node = _n as IToolNode;
				if (node.Kind !== "group")
					return [];
				return groups.get(node.Name) ?? [];
			},
			HasChildren: (_n) => (_n as IToolNode).Kind === "group",
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 세션 목록을 다시 깐다.
	private RefreshSessions(): void
	{
		this.sessions_.SetItems(McpHttpServer.SessionList().map((_s) => ({ Client: `${_s.Client} (${_s.CallCount})`, Id: _s.Id })));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 호출 로그를 다시 깐다.
	private RefreshCalls(): void
	{
		const entries = CallLogBuffer.Snapshot("", false);
		this.calls_.Count = entries.length;
		this.calls_.ItemTemplate = (_idx) =>
		{
			const row = new TextBlock();
			const entry = entries[_idx];
			if (entry !== undefined)
			{
				row.Text = `${entry.At.slice(11, 19)} ${entry.Ok ? "●" : "err"} ${entry.Tool}`;
				row.Element.addEventListener("click", () =>
				{
					this.detail_.Text = JSON.stringify(entry, null, 2);
				});
			}
			return row;
		};
		this.calls_.Refresh();
	}
}
