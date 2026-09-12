/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 정보 다이얼로그 코드비하인드. 버전 표시 + 닫기.
*/

import { Window, Button, DataList, RegisterWindow } from "@scouter/gui";
import { Paths } from "../Services/Paths";

@RegisterWindow("About")
export class AboutWindow extends Window
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫기 버튼을 연결한다. 버전은 직접 채운다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		_data.Set("appVersion", Paths.Version);
		const close = this.FindName(Button, "btn_close");
		close?.Click.Add(() =>
		{
			this.Close(undefined);
		});
	}
}
