/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ThemeSource. theme 접두어. 하이라이트 미리보기용.
*/

import { ThemeManager } from "../../../Theme/ThemeManager";
import { Fuzzy } from "../Fuzzy";
import type { IItemSource, IPaletteItem, IThemePaletteItem } from "./ItemSource";

const kMaxItems = 50;

export class ThemeSource implements IItemSource
{
	// ==================== 멤버 ====================
	public readonly Prefix = "theme ";

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마 fuzzy 상위 50개. 확정·원복은 창이 맡는다.
	// @param _text: 접두어 제거 쿼리
	public Query(_text: string): IPaletteItem[]
	{
		const query = _text.toLowerCase();
		const out: IThemePaletteItem[] = [];
		for (const theme of ThemeManager.List())
		{
			const score = Fuzzy.Score(query, `${theme.Name} ${theme.Id}`);
			if (score === null)
				continue;
			out.push({
				Kind: "Theme",
				Title: theme.Name,
				Subtitle: theme.Id,
				Hotkey: "theme",
				Score: score,
				ThemeId: theme.Id,
				Run: () => undefined,
			});
		}
		const collator = new Intl.Collator("ko");
		out.sort((_a, _b) => (_b.Score - _a.Score) || collator.compare(_a.Title, _b.Title));
		return out.slice(0, kMaxItems);
	}
}
