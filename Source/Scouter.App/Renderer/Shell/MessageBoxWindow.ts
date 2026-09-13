/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: MessageBoxWindow. App 확인창. ok 1개·yesno 2개 버튼으로 닫는다.
*/

import { Window, Button, DataList, RegisterWindow, Visibility } from "@scouter/gui";

@RegisterWindow("MessageBox")
export class MessageBoxWindow extends Window
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 종류에 맞는 버튼만 남기고 결과명을 달아 닫는다. ESC는 closed.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		const yesno = _data.Get("mode") === "yesno";
		const ok = this.FindName(Button, "btn_ok");
		const yes = this.FindName(Button, "btn_yes");
		const no = this.FindName(Button, "btn_no");
		if (yesno)
		{
			if (ok !== null)
				ok.Visibility = Visibility.Collapsed;
		}
		else
		{
			if (yes !== null)
				yes.Visibility = Visibility.Collapsed;
			if (no !== null)
				no.Visibility = Visibility.Collapsed;
		}
		ok?.Click.Add(() => { this.Close("ok"); });
		yes?.Click.Add(() => { this.Close("yes"); });
		no?.Click.Add(() => { this.Close("no"); });
	}
}
