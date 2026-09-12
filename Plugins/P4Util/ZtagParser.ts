/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ZtagParser. p4 -ztag 출력을 레코드로 푼다.
*/

import type { ZtagRecord } from "./Types";

//////////////////////////////////////////////////////////////////////////////////////
// 키 끝 숫자(depotFile0)를 떼고 베이스를 구한다.
function BaseOf(_key: string): string
{
	return _key.replace(/[0-9]+$/, "");
}

export class ZtagParser
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// ztag 텍스트를 파싱한다. 빈 줄은 레코드 구분, desc는 여러 줄.
	// @param _text: p4 -ztag stdout
	public static Parse(_text: string): ZtagRecord[]
	{
		const records: ZtagRecord[] = [];
		let current: ZtagRecord = {};
		let lastKey = "";
		let hasData = false;
		const flush = (): void =>
		{
			if (hasData)
				records.push(current);
			current = {};
			lastKey = "";
			hasData = false;
		};
		for (const rawLine of _text.split(/\r?\n/))
		{
			if (rawLine.trim().length === 0)
			{
				flush();
				continue;
			}
			if (!rawLine.startsWith("... "))
			{
				if (lastKey.length > 0)
				{
					const prev = current[lastKey];
					const appended = `${typeof prev === "string" ? prev : ""}\n${rawLine}`;
					current[lastKey] = appended;
				}
				continue;
			}
			const space = rawLine.indexOf(" ", 4);
			const key = space < 0 ? rawLine.slice(4) : rawLine.slice(4, space);
			const value = space < 0 ? "" : rawLine.slice(space + 1);
			lastKey = key;
			hasData = true;
			const base = BaseOf(key);
			if (base !== key || base in current)
			{
				const prev = current[base];
				if (typeof prev === "string")
					current[base] = [prev, value];
				else if (Array.isArray(prev))
					prev.push(value);
				else
					current[base] = value;
			}
			else
			{
				current[key] = value;
			}
		}
		flush();
		return records;
	}
}
