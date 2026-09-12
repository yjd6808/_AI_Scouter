/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CommandPalette 사이드바 뷰. 팔레트 열기 안내.
*/

import { UserControl, Button } from "@scouter/gui";
import type { DataList } from "@scouter/gui";
import { CommandRegistry } from "../../../Services/CommandRegistry";

export class MainView extends UserControl
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 열기 버튼을 묶는다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.FindName(Button, "btn_open")?.Click.Add(() =>
		{
			void CommandRegistry.Execute("CommandPalette.Open");
		});
	}
}
