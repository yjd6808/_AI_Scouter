/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: SpeechExecutor Plugin. 등록만 담당.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import { SpeechEngine } from "./SpeechEngine";
import type { IEngineUi } from "./SpeechEngine";
import { SendTextTool } from "./Tools/SendTextTool";
import { MainControl } from "./Views/MainControl";

export default class SpeechExecutorPlugin extends PluginBase
{
	// ==================== 멤버 ====================
	private engine_ = new SpeechEngine();

	// ==================== 재정의 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool·화면·레시피를 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		const ui: IEngineUi = MainControl.Sink;
		_ctx.Tools.Register(new SendTextTool(this.engine_));
		_ctx.Ui.RegisterWindow("Main", MainControl);
		MainControl.Configure(this.engine_);
		void this.engine_.BindAsync(_ctx, ui);
		void this.RegisterRecipesAsync(_ctx);
		// 앱 종료 직전에도 사이드카가 고아로 남지 않게 먼저 내린다.
		window.addEventListener("beforeunload", () =>
		{
			this.engine_.Shutdown();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 플러그인 해제. 사이드카를 반드시 종료한다.
	protected override OnDeactivate(): void
	{
		this.engine_.Shutdown();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 레시피를 리소스로 올린다.
	// @param _ctx: 컨텍스트
	private async RegisterRecipesAsync(_ctx: IPluginContext): Promise<void>
	{
		try
		{
			const text = await _ctx.Fs.ReadText(`${_ctx.Paths.PluginDir}/Recipes/SpeechExecutor.md`);
			_ctx.Resources.Register("recipes/SpeechExecutor", text, "text/markdown");
		}
		catch
		{
			// 무시.
		}
	}
}
