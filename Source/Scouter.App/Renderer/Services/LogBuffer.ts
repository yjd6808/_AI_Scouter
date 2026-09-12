/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: LogBuffer. 링 버퍼 10000 + 조회.
*/

import { SimpleEvent } from "@scouter/gui";
import type { ILogEntry, LogLevel } from "@scouter/gui";

export interface ILogFilter
{
	Level?: LogLevel;
	Scope?: string;
	Since?: number;
	Text?: string;
	Limit?: number;
}

const kOrder: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class LogBuffer
{
	// ==================== 멤버 ====================
	private readonly capacity_: number;
	private readonly entries_: ILogEntry[] = [];

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 용량으로 만든다.
	// @param _capacity: 최대 보관 (기본 10000)
	public constructor(_capacity = 10000)
	{
		this.capacity_ = _capacity;
	}

	// ==================== 이벤트 ====================
	public readonly Appended = new SimpleEvent<ILogEntry>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 1건을 쌓는다. 넘치면 앞 삭제.
	// @param _entry: 항목
	public Push(_entry: ILogEntry): void
	{
		this.entries_.push(_entry);
		while (this.entries_.length > this.capacity_)
			this.entries_.shift();
		this.Appended.Invoke(_entry);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 조건으로 조회한다. 새→오래 역순.
	// @param _filter: 조건
	public Query(_filter: ILogFilter): ILogEntry[]
	{
		const out: ILogEntry[] = [];
		const limit = _filter.Limit ?? 200;
		for (let idx = this.entries_.length - 1; idx >= 0; --idx)
		{
			const entry = this.entries_[idx] as ILogEntry;
			if (_filter.Level !== undefined && kOrder[entry.Level] < kOrder[_filter.Level])
				continue;
			if (_filter.Scope !== undefined && entry.Scope !== _filter.Scope)
				continue;
			if (_filter.Since !== undefined && entry.Ts < _filter.Since)
				continue;
			if (_filter.Text !== undefined && !entry.Msg.includes(_filter.Text))
				continue;
			out.push(entry);
			if (out.length >= limit)
				break;
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 지운다. 테스트용.
	public Clear(): void
	{
		this.entries_.length = 0;
	}
}
