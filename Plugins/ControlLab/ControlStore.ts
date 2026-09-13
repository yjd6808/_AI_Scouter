/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ControlStore. 컨트롤 이벤트를 메모리에 쌓는다.
*/

import type { IControlEvent, TControlEventKind } from "./Types";

const kMaxEvents = 200;

export class ControlStore
{
	// ==================== 멤버 ====================
	private events_: IControlEvent[] = [];

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이벤트 1건을 쌓는다. 200개 넘으면 앞에서 버린다.
	// @param _kind: 종류
	// @param _name: 컨트롤 이름
	// @param _detail: 상세
	public Log(_kind: TControlEventKind, _name: string, _detail: string): IControlEvent
	{
		const event: IControlEvent = { Kind: _kind, Name: _name, Detail: _detail, At: Date.now() };
		this.events_.push(event);
		while (this.events_.length > kMaxEvents)
			this.events_.shift();
		return event;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 지운다.
	public Clear(): void
	{
		this.events_.length = 0;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 개수를 구한다.
	public Count(): number
	{
		return this.events_.length;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 최근부터 최대 _limit개를 돌려준다.
	// @param _limit: 개수
	public Recent(_limit: number): IControlEvent[]
	{
		const limit = Math.max(0, Math.min(_limit, this.events_.length));
		return this.events_.slice(this.events_.length - limit).reverse();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전체를 오래된 순으로 돌려준다.
	public All(): IControlEvent[]
	{
		return [...this.events_];
	}
}
