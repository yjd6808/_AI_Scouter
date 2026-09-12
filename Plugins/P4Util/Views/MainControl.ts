/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P4Util 메인 화면. 추출 실행·취소·결과 표시.
*/

import { UserControl, TextBox, NumericUpDown, Button, CheckBox, ListView, LogView, StatusDot, DotStatus, ContextMenu, MenuItem } from "@scouter/gui";
import { GridView, GridViewColumn } from "@scouter/gui";
import type { DataList } from "@scouter/gui";
import { Shared } from "../P4Runner";
import { ExtractFilesTool } from "../Tools/ExtractFilesTool";
import type { IFileEntry } from "../Types";

interface IExtractResult
{
	Count: number;
	ChangeCount: number;
	Files: IFileEntry[];
	NeedsConfirm?: boolean;
}

export class MainControl extends UserControl
{
	// ==================== 정적 ====================
	private static s_clipboard_: ((_text: string) => void) | null = null;

	// ==================== 멤버 ====================
	private data_!: DataList;
	private abort_: AbortController | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 클립보드 기록기를 둔다. Index OnActivate에서 1회.
	// @param _write: 기록기
	public static SetClipboard(_write: (_text: string) => void): void
	{
		MainControl.s_clipboard_ = _write;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 버튼을 묶는다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.data_ = _data;
		const view = new GridView();
		view.AddColumn(new GridViewColumn({ Header: "Rev", DisplayMemberPath: "Rev", Width: 60, MinWidth: 40 }));
		view.AddColumn(new GridViewColumn({ Header: "Action", DisplayMemberPath: "Action", Width: 80, MinWidth: 40 }));
		view.AddColumn(new GridViewColumn({ Header: "Change", DisplayMemberPath: "Change", Width: 90, MinWidth: 40 }));
		view.AddColumn(new GridViewColumn({ Header: "Path", DisplayMemberPath: "DepotPath", Width: "*", MinWidth: 120 }));
		this.RequireName(ListView, "lst_files").View = view;
		this.FindName(Button, "btn_run")?.Click.Add(() =>
		{
			void this.OnRunClickAsync();
		});
		this.FindName(Button, "btn_cancel")?.Click.Add(() =>
		{
			this.abort_?.abort();
		});
		this.BindMenu();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 목록 우클릭 메뉴를 건다. 경로 복사 1종.
	private BindMenu(): void
	{
		const menu = new ContextMenu();
		const copy = new MenuItem();
		copy.Header = "경로 복사";
		copy.Click.Add(() =>
		{
			const list = this.RequireName(ListView, "lst_files");
			const paths: string[] = [];
			for (const selected of list.SelectedItems)
			{
				const path = (selected as Partial<IFileEntry>).DepotPath;
				if (typeof path === "string" && path.length > 0)
					paths.push(path);
			}
			if (paths.length > 0)
				MainControl.s_clipboard_?.(paths.join("\n"));
		});
		menu.AddItem(copy);
		this.RequireName(ListView, "lst_files").ContextMenu = menu;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 추출을 실행한다. 같은 Tool을 UI에서 직접 쓴다.
	private async OnRunClickAsync(): Promise<void>
	{
		if (this.abort_ !== null)
			return;
		const depot = this.RequireName(TextBox, "txt_depot").Text;
		const from = this.RequireName(NumericUpDown, "num_rev_from").Value;
		const to = this.RequireName(NumericUpDown, "num_rev_to").Value;
		const actions: string[] = [];
		if (this.RequireName(CheckBox, "chk_add").IsChecked)
			actions.push("add");
		if (this.RequireName(CheckBox, "chk_edit").IsChecked)
			actions.push("edit");
		if (this.RequireName(CheckBox, "chk_delete").IsChecked)
			actions.push("delete");
		const ext = this.RequireName(TextBox, "txt_ext").Text;
		const dedupe = this.RequireName(CheckBox, "chk_dedupe").IsChecked;
		const log = this.RequireName(LogView, "log_output");
		const dot = this.RequireName(StatusDot, "dot_state");
		const list = this.RequireName(ListView, "lst_files");
		const abort = new AbortController();
		this.abort_ = abort;
		this.data_.Set("isRunning", true);
		dot.Status = DotStatus.Busy;
		log.Clear();
		const started = Date.now();
		try
		{
			const tool = new ExtractFilesTool(Shared());
			const result = await tool.Run(
				{ Depot: depot, From: from, To: to, Actions: actions, Ext: ext, Dedupe: dedupe },
				{
					SessionId: "ui",
					Progress: (_n, _msg) => { this.data_.Set("stateText", _msg); },
					Signal: abort.signal,
					Log: (_msg) => { log.Append({ Ts: Date.now(), Level: "info", Scope: "P4Util", Msg: _msg }); },
				},
			) as IExtractResult;
			if (result.NeedsConfirm === true)
			{
				this.data_.Set("stateText", `범위 확인 필요 (${result.ChangeCount} 체인지)`);
				dot.Status = DotStatus.Warn;
				return;
			}
			list.SetItems(result.Files);
			this.data_.Set("fileCount", result.Files.length);
			this.data_.Set("stateText", `완료 ${((Date.now() - started) / 1000).toFixed(1)}s`);
			dot.Status = DotStatus.Ok;
		}
		catch (_e)
		{
			const aborted = abort.signal.aborted;
			this.data_.Set("stateText", aborted ? "중단됨" : String(_e));
			dot.Status = aborted ? DotStatus.Warn : DotStatus.Error;
			log.Append({ Ts: Date.now(), Level: "error", Scope: "P4Util", Msg: String(_e) });
		}
		finally
		{
			this.abort_ = null;
			this.data_.Set("isRunning", false);
		}
	}
}
