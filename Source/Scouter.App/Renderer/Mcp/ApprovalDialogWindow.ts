/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ApprovalDialogWindow. 승인 3종 + 기억 체크. 결과 객체로 닫는다.
*/

import { Window, Button, CheckBox, DataList, RegisterWindow } from "@scouter/gui";

export type ApprovalKind = "Allow" | "AllowAlways" | "Deny";

export interface IApprovalResult
{
	Kind: ApprovalKind;
	Remember: boolean;
}

@RegisterWindow("ApprovalDialog")
export class ApprovalDialogWindow extends Window
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 버튼 3종을 연결한다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.FindName(Button, "btn_deny")?.Click.Add(() =>
		{
			this.Finish("Deny");
		});
		this.FindName(Button, "btn_allow")?.Click.Add(() =>
		{
			this.Finish("Allow");
		});
		this.FindName(Button, "btn_always")?.Click.Add(() =>
		{
			this.Finish("AllowAlways");
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 결과를 확정하고 닫는다.
	// @param _kind: 승인 종류
	private Finish(_kind: ApprovalKind): void
	{
		const remember = this.FindName(CheckBox, "chk_remember")?.IsChecked ?? false;
		const result: IApprovalResult = { Kind: _kind, Remember: remember };
		this.Close(result);
	}
}
