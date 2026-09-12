/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: {{Name}} 플러그인. Tool·명령·메인 화면 뼈대.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import { MainControl } from "./Views/MainControl";

export default class ScaffoldPlugin extends PluginBase
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 메인 화면과 예제 명령을 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		_ctx.Ui.RegisterWindow("Main", MainControl);
		_ctx.Commands.Register("Say", {
			Title: "{{Name}} 말하기",
			Run: () =>
			{
				_ctx.Ui.Toast("{{Name}}");
			},
		});
	}
}
