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
	// ==================== 정적 ====================
	public static readonly DefaultFontSize = 13;

	// ==================== 멤버 ====================
	private static s_module_: Promise<typeof Monaco> | null = null;
	private static s_pending_: { Tokens: ReadonlyMap<string, string>; Dark: boolean } | null = null;
	private static s_fontSize_ = MonacoLoader.DefaultFontSize;
	private static readonly s_editors_ = new Set<{ updateOptions(_opts: { fontSize: number }): void }>();

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

	//////////////////////////////////////////////////////////////////////////////////////
	// 에디터 폰트 크기를 바꾼다. 살아있는 에디터·가상 리스트에 즉시 반영한다.
	// @param _px: 픽셀
	public static ApplyFontSize(_px: number): void
	{
		MonacoLoader.s_fontSize_ = _px;
		for (const editor of MonacoLoader.s_editors_)
		{
			try
			{
				editor.updateOptions({ fontSize: _px });
			}
			catch
			{
				continue;
			}
		}
		try
		{
			window.dispatchEvent(new CustomEvent("scouter:fontsize", { detail: _px }));
		}
		catch
		{
			// happy-dom 미지원 환경은 무시.
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 폰트 크기를 구한다.
	public static FontSize(): number
	{
		return MonacoLoader.s_fontSize_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 살아있는 에디터를 등록한다. Dispose 시 Untrack 호출.
	// @param _editor: 에디터
	public static Track(_editor: { updateOptions(_opts: { fontSize: number }): void }): void
	{
		MonacoLoader.s_editors_.add(_editor);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록된 에디터를 뺀다.
	// @param _editor: 에디터
	public static Untrack(_editor: { updateOptions(_opts: { fontSize: number }): void }): void
	{
		MonacoLoader.s_editors_.delete(_editor);
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
