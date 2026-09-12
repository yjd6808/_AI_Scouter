/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 설정 다이얼로그 코드비하인드. 닫기 버튼만 연결한다.
*/

import { Window, Button, DataList, RegisterWindow } from "@scouter/gui";

@RegisterWindow("Settings")
export class SettingsWindow extends Window
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫기 버튼을 연결한다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		const close = this.FindName(Button, "btn_close");
		close?.Click.Add(() =>
		{
			this.Close(undefined);
		});
	}
}
