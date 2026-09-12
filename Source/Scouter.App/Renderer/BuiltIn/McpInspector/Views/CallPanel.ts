/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CallPanel. 직접 호출 폼. PropertyGrid + 실행 + 결과.
*/

import { StackPanel, TextBlock, Button, TextBox, PropertyGrid, ListBox } from "@scouter/gui";
import { ToolRegistry } from "../../../Plugin/ToolRegistry";

export class CallPanel
{
	// ==================== 멤버 ====================
	private readonly panel_: StackPanel;
	private readonly title_: TextBlock;
	private readonly grid_: PropertyGrid;
	private readonly invoke_: Button;
	private readonly result_: TextBox;
	private fullName_ = "";
	private invoker_: ((_full: string, _args: Record<string, unknown>) => Promise<unknown>) | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// pnl_call 자리에서 조각을 찾는다.
	// @param _panel: pnl_call 패널
	// @param _list: 도구 목록 (선택 동기화용)
	public constructor(_panel: StackPanel, _list: ListBox)
	{
		this.panel_ = _panel;
		this.title_ = _panel.RequireName(TextBlock, "txt_tool");
		this.invoke_ = _panel.RequireName(Button, "btn_invoke");
		this.result_ = _panel.RequireName(TextBox, "txt_result");
		this.grid_ = new PropertyGrid();
		_panel.AddChild(this.grid_, 1);
		this.invoke_.Click.Add(() =>
		{
			void this.OnInvoke();
		});
		_list.SelectionChanged.Add(() =>
		{
			const item = _list.SelectedItem;
			if (typeof item === "string")
				this.Bind(item);
		});
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 호출기를 둔다. Plugin Index가 ctx.Tools.Invoke로 채운다.
	// @param _invoker: 호출기
	public SetInvoker(_invoker: (_full: string, _args: Record<string, unknown>) => Promise<unknown>): void
	{
		this.invoker_ = _invoker;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool을 바인딩한다. 스키마를 PropertyGrid에 깐다.
	// @param _fullName: 전체 Tool 이름
	public Bind(_fullName: string): void
	{
		this.fullName_ = _fullName;
		const found = ToolRegistry.Find(_fullName);
		if (found === null)
			return;
		this.title_.Text = `${_fullName}: ${found.Tool.Description}`;
		this.grid_.SetSchema(found.Tool.InputSchema, {});
		this.invoke_.IsEnabled = true;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행한다. 결과는 JSON 텍스트.
	private async OnInvoke(): Promise<void>
	{
		if (this.invoker_ === null || this.fullName_.length === 0)
			return;
		this.invoke_.IsEnabled = false;
		try
		{
			const result = await this.invoker_(this.fullName_, this.grid_.Get());
			this.result_.Text = JSON.stringify(result, null, 2);
		}
		catch (_e)
		{
			this.result_.Text = String(_e);
		}
		this.invoke_.IsEnabled = true;
	}
}
