/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Notes 메인 화면. 목록·편집·저장.
*/

import { UserControl, TextBox, Button, ListBox } from "@scouter/gui";
import type { DataList } from "@scouter/gui";
import { NoteStore } from "../NoteStore";

export class MainControl extends UserControl
{
	// ==================== 정적 ====================
	private static s_store_: NoteStore | null = null;
	private static s_fallback_: (() => string) | null = null;

	// ==================== 멤버 ====================
	private data_!: DataList;
	private current_ = "";

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소와 기본 노트를 둔다. Index OnActivate에서 1회.
	// @param _store: 저장소
	// @param _fallback: 기본 노트 제공자
	public static Configure(_store: NoteStore, _fallback: () => string): void
	{
		MainControl.s_store_ = _store;
		MainControl.s_fallback_ = _fallback;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 버튼을 묶고 목록을 채운다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.data_ = _data;
		this.FindName(Button, "btn_new")?.Click.Add(() =>
		{
			this.OnNew();
		});
		this.FindName(Button, "btn_save")?.Click.Add(() =>
		{
			void this.OnSaveAsync();
		});
		this.FindName(Button, "btn_refresh")?.Click.Add(() =>
		{
			void this.RefreshAsync();
		});
		this.FindName(ListBox, "lst_notes")?.SelectionChanged.Add(() =>
		{
			void this.OnSelectAsync();
		});
		void this.RefreshAsync();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 제목란으로 새 노트를 연다.
	private OnNew(): void
	{
		const title = this.RequireName(TextBox, "txt_title").Text.trim();
		this.current_ = title.length > 0 ? title : (MainControl.s_fallback_?.() ?? "inbox");
		this.RequireName(TextBox, "txt_body").Text = "";
		this.RequireName(TextBox, "txt_title").Text = "";
		this.data_.Set("stateText", `새 노트: ${this.current_}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 본문을 저장한다.
	private async OnSaveAsync(): Promise<void>
	{
		const store = MainControl.s_store_;
		if (store === null || this.current_.length === 0)
		{
			this.data_.Set("stateText", "목록에서 노트를 고르거나 새 노트를 여세요");
			return;
		}
		try
		{
			await store.WriteAsync(this.current_, this.RequireName(TextBox, "txt_body").Text);
			this.data_.Set("stateText", `저장됨: ${this.current_}`);
			await this.RefreshAsync();
		}
		catch (_e)
		{
			this.data_.Set("stateText", String(_e instanceof Error ? _e.message : _e));
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록을 다시 읽는다.
	private async RefreshAsync(): Promise<void>
	{
		const store = MainControl.s_store_;
		const list = this.RequireName(ListBox, "lst_notes");
		if (store === null)
			return;
		try
		{
			const infos = await store.ListAsync();
			list.SetItems(infos.map((_i) => _i.Name));
			this.data_.Set("noteCount", infos.length);
			this.data_.Set("stateText", "대기");
		}
		catch (_e)
		{
			this.data_.Set("stateText", String(_e instanceof Error ? _e.message : _e));
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 노트 본문을 읽는다.
	private async OnSelectAsync(): Promise<void>
	{
		const store = MainControl.s_store_;
		if (store === null)
			return;
		const selected = this.RequireName(ListBox, "lst_notes").SelectedItem;
		if (typeof selected !== "string")
			return;
		this.current_ = selected;
		this.RequireName(TextBox, "txt_body").Text = await store.ReadAsync(selected);
		this.data_.Set("stateText", selected);
	}
}
