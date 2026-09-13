/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ToastLab Plugin. 토스트 1종 + 확인창 1종 + 화면 + 레시피.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import { NotifyTool } from "./Tools/NotifyTool";
import { MessageTool } from "./Tools/MessageTool";
import { MainControl } from "./Views/MainControl";
import type { TNotifySink, TMessageSink } from "./Types";

export default class ToastLabPlugin extends PluginBase
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool·화면·레시피를 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		const notify: TNotifySink = (_kind, _title, _message, _global) =>
		{
			_ctx.Ui.Notify(_kind, _message.length > 0 ? `${_title}\n${_message}` : _title);
			if (_global)
				void _ctx.Ui.NotifyGlobal(_kind, _title, _message);
		};
		const message: TMessageSink = (_scope, _title, _message, _kind, _durationSec, _topmost) =>
		{
			return _ctx.Ui.MessageBox({
				Scope: _scope, Title: _title, Message: _message, Kind: _kind,
				DurationMs: Math.round(_durationSec * 1000), Topmost: _topmost,
			});
		};
		_ctx.Tools.Register(new NotifyTool(notify));
		_ctx.Tools.Register(new MessageTool(message));
		_ctx.Ui.RegisterWindow("Main", MainControl);
		MainControl.Configure(notify, message);
		void this.RegisterRecipesAsync(_ctx);
		_ctx.Prompts.Register("ToastLab", {
			Description: "토스트 테스트 절차",
			Build: () =>
			{
				return "ToastLab 레시피에 따라 scouter://ToastLab/recipes/ToastLab 리소스를 읽고 ToastLab__Notify로 확인하라.";
			},
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 레시피를 리소스로 올린다.
	// @param _ctx: 컨텍스트
	private async RegisterRecipesAsync(_ctx: IPluginContext): Promise<void>
	{
		try
		{
			const text = await _ctx.Fs.ReadText(`${_ctx.Paths.PluginDir}/Recipes/ToastLab.md`);
			_ctx.Resources.Register("recipes/ToastLab", text, "text/markdown");
		}
		catch
		{
			// 무시.
		}
	}
}
