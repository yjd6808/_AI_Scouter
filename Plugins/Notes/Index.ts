/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Notes Plugin. 메모 4종 + 화면 + 레시피.
*/

import { PluginBase } from "@scouter/plugin-api";
import type { IPluginContext } from "@scouter/plugin-api";
import { NoteStore } from "./NoteStore";
import { AppendTool } from "./Tools/AppendTool";
import { ReadTool } from "./Tools/ReadTool";
import { ListTool } from "./Tools/ListTool";
import { SearchTool } from "./Tools/SearchTool";
import { MainControl } from "./Views/MainControl";

export default class NotesPlugin extends PluginBase
{
	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Tool 4종·화면·레시피를 등록한다.
	// @param _ctx: 컨텍스트
	protected override OnActivate(_ctx: IPluginContext): void
	{
		const store = new NoteStore(_ctx.Fs, `${_ctx.Paths.StorageDir}/notes`);
		const fallback = (): string => _ctx.Settings.Get<string>("DefaultNote", "inbox");
		_ctx.Tools.Register(new AppendTool(store, fallback));
		_ctx.Tools.Register(new ReadTool(store));
		_ctx.Tools.Register(new ListTool(store));
		_ctx.Tools.Register(new SearchTool(store));
		_ctx.Ui.RegisterWindow("Main", MainControl);
		MainControl.Configure(store, fallback);
		void this.RegisterRecipesAsync(_ctx);
		_ctx.Prompts.Register("Notes", {
			Description: "메모 추가 레시피",
			Build: () =>
			{
				return "Notes 레시피에 따라 scouter://Notes/recipes/Notes 리소스를 읽고 Notes__Append로 기록하라.";
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
			const text = await _ctx.Fs.ReadText(`${_ctx.Paths.PluginDir}/Recipes/Notes.md`);
			_ctx.Resources.Register("recipes/Notes", text, "text/markdown");
		}
		catch
		{
			// 무시.
		}
	}
}
