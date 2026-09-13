/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeResolver. defs 참조 해석 + 폴백 채움. 데스크톱 테마는 별칭 매핑.
*/

import { kCoreTokens, kDesktopCoreAliases } from "./Theme";
import type { ITheme, IResolvedTheme, ThemeScheme } from "./Theme";

export class ThemeResolver
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마를 스킴으로 푼다. 누락은 폴백에서, 그래도 없으면 마젠타.
	// @param _theme: 테마
	// @param _scheme: 스킴
	// @param _fallback: 폴백 해석
	public static Resolve(_theme: ITheme, _scheme: ThemeScheme, _fallback: IResolvedTheme | null): IResolvedTheme
	{
		if (_theme.Desktop !== undefined)
			return ThemeResolver.ResolveDesktop(_theme, _scheme, _fallback);
		const out = new Map<string, string>();
		const missing: string[] = [];
		const keys = new Set([...kCoreTokens, ...Object.keys(_theme.Tokens)]);
		for (const token of keys)
		{
			const raw = _theme.Tokens[token]?.[_scheme === "Dark" ? "dark" : "light"];
			const value = raw === undefined ? null : ThemeResolver.ResolveRef(_theme.Defs, raw, 0);
			if (value === null)
			{
				missing.push(token);
				out.set(token, _fallback?.Tokens.get(token) ?? "#ff00ff");
				continue;
			}
			out.set(token, value);
		}
		if (missing.length > 0)
		{
			// 호출자(Log)가 기록. 여기서는 조용히 폴백.
		}
		return { Id: _theme.Id, Scheme: _scheme, Tokens: out };
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 데스크톱 테마를 푼다. 코어 토큰은 별칭으로, 나머지는 통째로 얹는다.
	// @param _theme: 테마
	// @param _scheme: 스킴
	// @param _fallback: 폴백 해석
	private static ResolveDesktop(_theme: ITheme, _scheme: ThemeScheme, _fallback: IResolvedTheme | null): IResolvedTheme
	{
		const desktop = _theme.Desktop;
		if (desktop === undefined)
			throw new Error("[ThemeResolver] 데스크톱 토큰 없음");
		const src = _scheme === "Dark" ? desktop.Dark : desktop.Light;
		const other = _scheme === "Dark" ? desktop.Light : desktop.Dark;
		const out = new Map<string, string>();
		for (const token of kCoreTokens)
		{
			const desktopKey = kDesktopCoreAliases.get(token) ?? token;
			const value = src[desktopKey] ?? other[desktopKey] ?? _fallback?.Tokens.get(token) ?? "#ff00ff";
			out.set(token, value);
		}
		for (const [key, value] of Object.entries(src))
		{
			if (!out.has(key))
				out.set(key, value);
		}
		return { Id: _theme.Id, Scheme: _scheme, Tokens: out };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// defs 참조를 최대 8단계까지 푼다. 순환이면 null.
	// @param _defs: 정의
	// @param _value: 원문
	// @param _depth: 깊이
	private static ResolveRef(_defs: Record<string, string>, _value: string, _depth: number): string | null
	{
		if (_depth > 8)
			return null;
		const trimmed = _value.trim();
		if (!trimmed.startsWith("$"))
			return trimmed;
		const key = trimmed.slice(1);
		const found = _defs[key];
		if (found === undefined)
			return null;
		return ThemeResolver.ResolveRef(_defs, found, _depth + 1);
	}
}
