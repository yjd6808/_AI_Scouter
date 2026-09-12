/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: {{Name}} 메인 화면. 환영 문구 1줄.
*/

import { UserControl, TextBlock } from "@scouter/gui";
import type { DataList } from "@scouter/gui";

export class MainControl extends UserControl
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 문구를 채운다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		const text = new TextBlock();
		text.Text = "{{Name}}";
		this.Content = text;
	}
}
