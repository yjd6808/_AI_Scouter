/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ConnectView. MCP 상태·스니펫·복사·재발급.
*/

import { UserControl, ComboBox, Button, TextBox, DataList } from "@scouter/gui";
import { McpHttpServer } from "../../../Mcp/McpHttpServer";
import { Clipboard } from "../../../Services/Clipboard";
import { ToastService } from "@scouter/gui";
import { ConnectSnippets } from "../ConnectSnippets";

export class ConnectView extends UserControl
{
	// ==================== 멤버 ====================
	private combo_!: ComboBox;
	private snippet_!: TextBox;
	private client_ = "Claude Code";

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태·스니펫을 채운다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.combo_ = this.RequireName(ComboBox, "cmb_client");
		this.snippet_ = this.RequireName(TextBox, "txt_snippet");
		void this.LoadClientsAsync();
		this.combo_.SelectionChanged.Add(() =>
		{
			const item = this.combo_.SelectedItem;
			if (typeof item === "string")
			{
				this.client_ = item;
				this.RenderSnippet();
			}
		});
		this.FindName(Button, "btn_copy")?.Click.Add(() =>
		{
			if (Clipboard.WriteText(this.snippet_.Text))
				ToastService.Success("복사됨");
		});
		this.FindName(Button, "btn_regen_token")?.Click.Add(() =>
		{
			void this.RegenAsync();
		});
		this.RenderStatus(_data);
		this.RenderSnippet();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태 줄을 쓴다.
	// @param _data: 바인딩 소스
	private RenderStatus(_data: DataList): void
	{
		const sessions = McpHttpServer.SessionList().length;
		_data.Set("statusLine", `실행 중 http://127.0.0.1:${McpHttpServer.Port}/mcp · 세션 ${sessions}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 클라이언트 목록을 채운다.
	private async LoadClientsAsync(): Promise<void>
	{
		const clients = await ConnectSnippets.Clients();
		this.combo_.SetItems(clients);
		if (!clients.includes(this.client_) && clients.length > 0)
			this.client_ = clients[0] as string;
		this.combo_.SelectedItem = this.client_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스니펫을 렌더한다.
	private RenderSnippet(): void
	{
		const token = McpHttpServer.Auth?.Token ?? "";
		const url = `http://127.0.0.1:${McpHttpServer.Port}`;
		ConnectSnippets.Render(this.client_, url, token).then((_text) =>
		{
			this.snippet_.Text = _text;
		}).catch(() =>
		{
			this.snippet_.Text = "";
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰 재발급 후 다시 그린다.
	private async RegenAsync(): Promise<void>
	{
		await McpHttpServer.RegenerateTokenAsync();
		this.RenderSnippet();
		ToastService.Success("토큰 재발급. 클라이언트 설정을 업데이트하세요");
	}
}
