/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P4Util Plugin. p4 읽기 전용 7종 + 화면 + 레시피.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import { P4Runner, ConfigureShared } from "./P4Runner";
import type { IP4Settings } from "./Types";
import { ExtractFilesTool } from "./Tools/ExtractFilesTool";
import { DescribeTool } from "./Tools/DescribeTool";
import { OpenedSummaryTool } from "./Tools/OpenedSummaryTool";
import { ChangeFilesTool } from "./Tools/ChangeFilesTool";
import { BlameTool } from "./Tools/BlameTool";
import { DiffRangeTool } from "./Tools/DiffRangeTool";
import { ReviewPromptTool } from "./Tools/ReviewPromptTool";
import { MainControl } from "./Views/MainControl";

function ReadSettings(_ctx: IPluginContext): IP4Settings
{
	return {
		get Port(): string { return _ctx.Settings.Get<string>("P4Port", ""); },
		get User(): string { return _ctx.Settings.Get<string>("P4User", ""); },
		get Client(): string { return _ctx.Settings.Get<string>("P4Client", ""); },
		get Charset(): string { return _ctx.Settings.Get<string>("P4Charset", "utf8"); },
		get DescribeBatch(): number { return _ctx.Settings.Get<number>("DescribeBatch", 20); },
		get MaxChanges(): number { return _ctx.Settings.Get<number>("MaxChanges", 2000); },
	};
}

export default class P4UtilPlugin extends PluginBase
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool 7종·화면·명령·레시피를 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		const runner = new P4Runner(
			{ Exec: (_cmd, _args, _opts) => _ctx.Shell.Exec(_cmd, _args, _opts) },
			ReadSettings(_ctx),
		);
		ConfigureShared(runner);
		const emitFile = async (_name: string, _text: string): Promise<string> =>
		{
			const full = `${_ctx.Paths.StorageDir}/output/${_name}`;
			await _ctx.Fs.WriteText(full, _text);
			return full;
		};
		_ctx.Tools.Register(new ExtractFilesTool(
			runner,
			emitFile,
			(_text) => { _ctx.Clipboard.WriteText(_text); },
		));
		_ctx.Tools.Register(new DescribeTool(runner));
		_ctx.Tools.Register(new OpenedSummaryTool(runner));
		_ctx.Tools.Register(new ChangeFilesTool(runner));
		_ctx.Tools.Register(new BlameTool(runner));
		_ctx.Tools.Register(new DiffRangeTool(runner));
		_ctx.Tools.Register(new ReviewPromptTool(runner));
		_ctx.Ui.RegisterWindow("Main", MainControl);
		MainControl.SetClipboard((_text) => { _ctx.Clipboard.WriteText(_text); });
		_ctx.Commands.Register("CopyPrompt", {
			Title: "AI 프롬프트 복사",
			Hotkey: "Ctrl+Shift+C",
			Run: () =>
			{
				this.CopyPrompt(_ctx);
			},
		});
		void this.RegisterRecipesAsync(_ctx);
		_ctx.Prompts.Register("ExtractFiles", {
			Description: "범위 파일 추출 레시피",
			Build: (_args) =>
			{
				const raw = _args["Recipe"];
				const name = typeof raw === "string" ? raw : "ExtractFiles";
				return `P4Util 레시피 ${name}에 따라 scouter://P4Util/recipes/${name} 리소스를 읽고 P4Util__ExtractFiles로 추출하라.`;
			},
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 레시피 3종을 리소스로 올린다.
	// @param _ctx: 컨텍스트
	private async RegisterRecipesAsync(_ctx: IPluginContext): Promise<void>
	{
		for (const name of ["ExtractFiles", "Review", "OpenedSummary"])
		{
			try
			{
				const text = await _ctx.Fs.ReadText(`${_ctx.Paths.PluginDir}/Recipes/${name}.md`);
				_ctx.Resources.Register(`recipes/${name}`, text, "text/markdown");
			}
			catch
			{
				continue;
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 파일 + 범위 프롬프트를 복사한다.
	// @param _ctx: 컨텍스트
	private CopyPrompt(_ctx: IPluginContext): void
	{
		const depot = _ctx.Settings.Get<string>("DefaultDepot", "");
		const prompt = [
			"다음 파일들의 변경을 리뷰하라 (목록 n개). MCP Tool P4Util__DiffRange 사용.",
			`Depot: ${depot}`,
		].join("\n");
		_ctx.Clipboard.WriteText(prompt);
		_ctx.Ui.Toast("프롬프트 복사됨");
	}
}
