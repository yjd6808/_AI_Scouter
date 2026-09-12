/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Fuzzy. 순서 매칭 점수 + 강조 구간 분할.
*/

export interface IHighlightRun
{
	Text: string;
	Match: boolean;
}

export class Fuzzy
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 쿼리 문자가 순서대로 모두 등장하면 점수, 아니면 null.
	// @param _query: 소문자 쿼리
	// @param _text: 대상 문자열
	public static Score(_query: string, _text: string): number | null
	{
		if (_query.length === 0)
			return 0;
		const text = _text.toLowerCase();
		let score = 0;
		let prev = -2;
		let ti = 0;
		for (const ch of _query)
		{
			const idx = text.indexOf(ch, ti);
			if (idx < 0)
				return null;
			score += 1;
			if (idx === prev + 1)
				score += 5;
			if (idx === 0 || " ._:/-".includes(text[idx - 1] ?? ""))
				score += 10;
			prev = idx;
			ti = idx + 1;
		}
		return score - Math.floor(text.length / 20);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 매칭 구간을 일치·불일치 런으로 나눈다. 불일치면 null.
	// @param _query: 소문자 쿼리
	// @param _text: 원문
	public static Highlight(_query: string, _text: string): IHighlightRun[] | null
	{
		if (_query.length === 0)
			return [{ Text: _text, Match: false }];
		const lower = _text.toLowerCase();
		const hits: number[] = [];
		let ti = 0;
		for (const ch of _query)
		{
			const idx = lower.indexOf(ch, ti);
			if (idx < 0)
				return null;
			hits.push(idx);
			ti = idx + 1;
		}
		const out: IHighlightRun[] = [];
		let pos = 0;
		for (const hit of hits)
		{
			if (hit > pos)
				out.push({ Text: _text.slice(pos, hit), Match: false });
			out.push({ Text: _text.slice(hit, hit + 1), Match: true });
			pos = hit + 1;
		}
		if (pos < _text.length)
			out.push({ Text: _text.slice(pos), Match: false });
		return out;
	}
}
