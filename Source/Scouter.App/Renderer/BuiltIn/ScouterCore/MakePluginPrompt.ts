/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MakePlugin 프롬프트. Plugin 제작 절차 지시.
*/

import type { IPluginContext } from "@scouter/plugin-api";

export class MakePluginPrompt
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 프롬프트를 등록한다.
	// @param _ctx: 컨텍스트
	public static Register(_ctx: IPluginContext): void
	{
		_ctx.Prompts.Register("MakePlugin", {
			Description: "새 Plugin 만들기",
			Build: (_args) =>
			{
				const raw = _args["Description"];
				const desc = typeof raw === "string" ? raw : "(설명 없음)";
				return [
					`Plugin 설명: ${desc}`,
					"1) scouter://core/docs/plugin-api, controls, layout-syntax 3개를 읽는다.",
					"2) ScouterCore__PluginScaffold로 뼈대를 만든다.",
					"3) Index.ts/Main.xml을 작성한다.",
					"4) ScouterCore__PluginLint로 검사한다.",
					"5) ScouterCore__PluginReload로 올린다.",
					"6) ScouterCore__Screenshot으로 화면을 확인한다.",
					"7) ScouterCore__LogQuery Level=Error로 오류를 확인한다.",
				].join("\n");
			},
		});
	}
}
