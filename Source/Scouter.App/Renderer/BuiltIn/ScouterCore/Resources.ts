/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ScouterCore 리소스. 설정 스키마·테마 토큰·최근 로그.
*/

import type { IPluginContext } from "@scouter/plugin-api";
import { Log } from "../../Services/Log";
import { kCoreTokens } from "@scouter/gui";
import schemaJson from "../../../Config/Settings.schema.json" with { type: "json" };

export class DocsResources
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 리소스 3종을 등록한다.
	// @param _ctx: 컨텍스트
	public static Register(_ctx: IPluginContext): void
	{
		_ctx.Resources.Register("settings-schema", JSON.stringify(schemaJson), "application/json");
		_ctx.Resources.Register("theme/tokens", kCoreTokens.join("\n"), "text/plain");
		_ctx.Resources.Register("logs/recent", DocsResources.RecentLogs(), "text/plain");
		_ctx.Resources.Register("docs/plugin-api", "IPluginContext 서비스 표는 ScouterCore 설정 화면과 PluginManager 코드를 볼 것. Tool 등록은 ctx.Tools.Register.", "text/markdown");
		_ctx.Resources.Register("docs/controls", "Grid/StackPanel/DockPanel + Button/TextBox/ListBox/ComboBox/TabControl/ListView/PropertyGrid. XML Name은 snake_case.", "text/markdown");
		_ctx.Resources.Register("docs/layout-syntax", "바인딩 {@key} {#name.Prop} {$settings.Path}. 문자 속성은 항상 보간.", "text/markdown");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 최근 500줄을 묶는다.
	private static RecentLogs(): string
	{
		return Log.Buffer.Query({ Limit: 500 }).map((_e) => `${new Date(_e.Ts).toISOString()} [${_e.Level}] ${_e.Scope} ${_e.Msg}`).join("\n");
	}
}
