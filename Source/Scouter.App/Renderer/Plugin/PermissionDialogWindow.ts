/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 권한 다이얼로그 코드비하인드. 허용/거부.
*/

import { Window, Button, DataList, RegisterWindow } from "@scouter/gui";

@RegisterWindow("PermissionDialog")
export class PermissionDialogWindow extends Window
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 버튼 2종을 연결한다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.FindName(Button, "btn_allow")?.Click.Add(() =>
		{
			this.Close(true);
		});
		this.FindName(Button, "btn_deny")?.Click.Add(() =>
		{
			this.Close(false);
		});
	}
}
