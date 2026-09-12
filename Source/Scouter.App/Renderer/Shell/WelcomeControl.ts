/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 환영 뷰. Plugin이 없을 때 콘텐츠 자리 표시.
*/

import { UserControl, TextBlock, RegisterWindow, StackPanel } from "@scouter/gui";
import type { DataList } from "@scouter/gui";

@RegisterWindow("Shell/Welcome")
export class WelcomeControl extends UserControl
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 환영 문구를 채운다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		const stack = new StackPanel();
		const text = new TextBlock();
		text.Text = "Scouter P3 — Plugin은 P6에서";
		stack.AddChild(text);
		this.Content = stack;
	}
}
