/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Hello 검증 Plugin. Tool 1개 + 명령 1개 + 메인 화면.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import { HelloControl } from "./Views/HelloControl";

export default class HelloPlugin extends PluginBase
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Echo Tool·Say 명령·메인 화면을 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		_ctx.Ui.RegisterWindow("Main", HelloControl);
		_ctx.Tools.Register({
			Name: "Echo",
			Description: "받은 문자열을 돌려준다.",
			InputSchema: { type: "object", properties: { Text: { type: "string" } } },
			Run: (_args) =>
			{
				const text = _args["Text"];
				return Promise.resolve({ Echo: typeof text === "string" ? text : "" });
			},
		});
		_ctx.Commands.Register("Say", {
			Title: "Hello 말하기",
			Run: () =>
			{
				_ctx.Ui.Toast("hello");
			},
		});
	}
}
