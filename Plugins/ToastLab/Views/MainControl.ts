/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ToastLab 메인 화면. 종류·바탕화면 버튼으로 토스트 발사.
*/

import { UserControl, TextBox, Button, CheckBox } from "@scouter/gui";
import type { DataList } from "@scouter/gui";
import type { TToastKind, TNotifySink, TMessageSink } from "../Types";

const kKinds: ReadonlyArray<{ Button: string; Kind: TToastKind }> = [
	{ Button: "btn_info", Kind: "info" },
	{ Button: "btn_success", Kind: "success" },
	{ Button: "btn_warn", Kind: "warn" },
	{ Button: "btn_error", Kind: "error" },
];

export class MainControl extends UserControl
{
	// ==================== 정적 ====================
	private static s_notify_: TNotifySink | null = null;
	private static s_message_: TMessageSink | null = null;

	// ==================== 멤버 ====================
	private data_!: DataList;
	private count_ = 0;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 알림·확인창 싱크를 둔다. Index OnActivate에서 1회.
	// @param _notify: 종류·제목·내용·바탕화면 표시자
	// @param _message: 범위·제목·내용 표시자
	public static Configure(_notify: TNotifySink, _message: TMessageSink): void
	{
		MainControl.s_notify_ = _notify;
		MainControl.s_message_ = _message;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 종류 버튼 4개와 확인창 버튼 2개를 묶는다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.data_ = _data;
		for (const item of kKinds)
		{
			const kind = item.Kind;
			this.FindName(Button, item.Button)?.Click.Add(() =>
			{
				this.Fire(kind);
			});
		}
		this.FindName(Button, "btn_msg_app")?.Click.Add(() =>
		{
			void this.Ask("App");
		});
		this.FindName(Button, "btn_msg_global")?.Click.Add(() =>
		{
			void this.Ask("Global");
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 입력 제목·내용으로 토스트를 쏜다. 체크면 바탕화면에도.
	// @param _kind: 토스트 종류
	private Fire(_kind: TToastKind): void
	{
		const title = this.RequireName(TextBox, "txt_title").Text.trim();
		const message = this.RequireName(TextBox, "txt_message").Text;
		const global = this.FindName(CheckBox, "chk_global")?.IsChecked === true;
		this.count_ += 1;
		this.data_.Set("fireCount", this.count_);
		MainControl.s_notify_?.(_kind, title.length > 0 ? title : `테스트 ${_kind}`, message, global);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 입력 제목·내용으로 확인창을 띄운다. 결과는 발화 횟수에 덧씌운다.
	// @param _scope: 확인창 범위
	private async Ask(_scope: "App" | "Global"): Promise<void>
	{
		const sink = MainControl.s_message_;
		if (sink === null)
			return;
		const title = this.RequireName(TextBox, "txt_title").Text.trim();
		const message = this.RequireName(TextBox, "txt_message").Text;
		const result = await sink(_scope, title.length > 0 ? title : "확인", message, "yesno", 0, false);
		this.count_ += 1;
		this.data_.Set("fireCount", this.count_);
		this.data_.Set("lastResult", result);
	}
}
