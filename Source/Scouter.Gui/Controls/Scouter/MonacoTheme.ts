/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MonacoTheme. 토큰 → monaco 테마 데이터.
*/

import type { editor } from "monaco-editor";

export class MonacoTheme
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰 맵을 monaco 테마로 바꾼다. 없는 토큰은 건너뛴다.
	// @param _tokens: 해석 토큰
	// @param _dark: 다크 여부
	public static FromTokens(_tokens: ReadonlyMap<string, string>, _dark: boolean): editor.IStandaloneThemeData
	{
		const get = (_key: string): string | null =>
		{
			const raw = _tokens.get(_key);
			if (raw === undefined)
				return null;
			const hex = raw.replace("#", "");
			return hex.length >= 6 ? hex.slice(0, 6) : null;
		};
		const color = (_key: string, _def: string): string =>
		{
			return `#${get(_key) ?? _def}`;
		};
		const colors: Record<string, string> = {};
		const paint = (_key: string, _token: string, _def: string): void =>
		{
			colors[_key] = color(_token, _def);
		};
		paint("editor.background", "background-base", "1e1e1e");
		paint("editor.foreground", "text-base", "d4d4d4");
		paint("editor.lineHighlightBackground", "background-hover", "2a2d2e");
		paint("editorLineNumber.foreground", "text-weak", "858585");
		paint("editor.selectionBackground", "primary-muted", "264f78");
		paint("editorCursor.foreground", "primary", "aeafad");
		paint("editorWidget.background", "background-panel", "252526");
		paint("editorWidget.border", "border", "454545");
		const rules: editor.ITokenThemeRule[] = [];
		const rule = (_token: string, _key: string, _style: string): void =>
		{
			const hex = get(_key);
			if (hex === null)
				return;
			if (_style.length > 0)
				rules.push({ token: _token, foreground: hex, fontStyle: _style });
			else
				rules.push({ token: _token, foreground: hex });
		};
		rule("keyword", "syntax-keyword", "");
		rule("string", "syntax-string", "");
		rule("comment", "syntax-comment", "italic");
		rule("number", "syntax-number", "");
		rule("type", "syntax-type", "");
		rule("function", "syntax-function", "");
		return {
			base: _dark ? "vs-dark" : "vs",
			inherit: true,
			colors: colors,
			rules: rules,
		};
	}
}
