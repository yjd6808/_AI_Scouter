/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: McpInspector 내장 Plugin. ToolCalled 버퍼 + 화면.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import { InspectorMainControl } from "./Views/InspectorMainControl";
import { CallLogBuffer } from "./CallLogBuffer";

export default class McpInspectorPlugin extends PluginBase
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 화면·이벤트·명령을 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		_ctx.Ui.RegisterWindow("Main", InspectorMainControl);
		InspectorMainControl.SetInvoker((_full, _args) => _ctx.Tools.Invoke(_full, _args));
		_ctx.Events.On("Scouter.ToolCalled", (_args) =>
		{
			CallLogBuffer.Push(_args as { At?: string; Tool?: string; Session?: string; Decision?: string; Ok?: boolean });
		});
		_ctx.Events.On("Scouter.McpSessionsChanged", () =>
		{
			// 화면이 열려 있으면 갱신. 닫혀 있어도 버퍼는 유지.
		});
		_ctx.Commands.Register("Clear", {
			Title: "호출 로그 지우기",
			Run: () =>
			{
				CallLogBuffer.Clear();
			},
		});
	}
}
