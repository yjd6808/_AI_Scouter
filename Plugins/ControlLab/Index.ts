/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ControlLab Plugin. 이벤트 기록 2종 + 화면 + 레시피.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import { ControlStore } from "./ControlStore";
import { LogTool } from "./Tools/LogTool";
import { StateTool } from "./Tools/StateTool";
import { MainControl } from "./Views/MainControl";

export default class ControlLabPlugin extends PluginBase
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool·화면·레시피를 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		const store = new ControlStore();
		_ctx.Tools.Register(new LogTool(store));
		_ctx.Tools.Register(new StateTool(store));
		_ctx.Ui.RegisterWindow("Main", MainControl);
		MainControl.Configure(store);
		void this.RegisterRecipesAsync(_ctx);
		_ctx.Prompts.Register("ControlLab", {
			Description: "컨트롤 테스트 절차",
			Build: () =>
			{
				return "ControlLab 레시피에 따라 scouter://ControlLab/recipes/ControlLab 리소스를 읽고 ControlLab__State로 확인하라.";
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
			const text = await _ctx.Fs.ReadText(`${_ctx.Paths.PluginDir}/Recipes/ControlLab.md`);
			_ctx.Resources.Register("recipes/ControlLab", text, "text/markdown");
		}
		catch
		{
			// 무시.
		}
	}
}
