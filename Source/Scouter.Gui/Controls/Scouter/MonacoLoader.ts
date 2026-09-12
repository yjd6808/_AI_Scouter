/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MonacoLoader. monaco 지연 로드 + 테마 적용.
*/

import type * as Monaco from "monaco-editor";
import { MonacoTheme } from "./MonacoTheme";

export class MonacoLoader
{
	// ==================== 멤버 ====================
	private static s_module_: Promise<typeof Monaco> | null = null;
	private static s_pending_: { Tokens: ReadonlyMap<string, string>; Dark: boolean } | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// monaco를 1회 로드한다. 대기 테마가 있으면 입힌다.
	public static LoadAsync(): Promise<typeof Monaco>
	{
		if (MonacoLoader.s_module_ === null)
		{
			MonacoLoader.s_module_ = import("monaco-editor").then((_m) =>
			{
				MonacoLoader.ApplyPending(_m);
				return _m;
			});
		}
		return MonacoLoader.s_module_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마를 저장하고 로드됐으면 즉시 입힌다.
	// @param _tokens: 해석 토큰
	// @param _dark: 다크 여부
	public static ApplyTheme(_tokens: ReadonlyMap<string, string>, _dark: boolean): void
	{
		MonacoLoader.s_pending_ = { Tokens: _tokens, Dark: _dark };
		if (MonacoLoader.s_module_ === null)
			return;
		void MonacoLoader.s_module_.then((_m) =>
		{
			MonacoLoader.ApplyPending(_m);
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 대기 테마를 monaco에 입힌다.
	// @param _m: monaco 모듈
	private static ApplyPending(_m: typeof Monaco): void
	{
		const pending = MonacoLoader.s_pending_;
		if (pending === null)
			return;
		_m.editor.defineTheme("scouter", MonacoTheme.FromTokens(pending.Tokens, pending.Dark));
		_m.editor.setTheme("scouter");
	}
}
