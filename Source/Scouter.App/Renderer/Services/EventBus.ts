/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: EventBus. 토픽 발행·구독. 와일드카드 접미사 지원.
*/

import type { IDisposable } from "@scouter/gui";

export class EventBus
{
	// ==================== 정적 ====================
	private static readonly s_handlers_ = new Map<string, Set<(_payload: unknown) => void>>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 토픽을 발행한다. 동기·순차. 핸들러 예외는 격리.
	// @param _topic: 토픽 (Scouter.* / {PluginId}.*)
	// @param _payload: 전달값
	public static Publish(_topic: string, _payload: unknown): void
	{
		for (const [pattern, set] of EventBus.s_handlers_)
		{
			if (!EventBus.Matches(pattern, _topic))
				continue;
			for (const handler of [...set])
			{
				try
				{
					handler(_payload);
				}
				catch
				{
					continue;
				}
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 구독한다. 패턴 끝 *는 접두 매칭.
	// @param _pattern: 토픽 또는 패턴
	// @param _handler: 핸들러
	public static Subscribe(_pattern: string, _handler: (_payload: unknown) => void): IDisposable
	{
		let set = EventBus.s_handlers_.get(_pattern);
		if (set === undefined)
		{
			set = new Set();
			EventBus.s_handlers_.set(_pattern, set);
		}
		const live = set;
		live.add(_handler);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				live.delete(_handler);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 다음 발행 1회를 기다린다.
	// @param _topic: 토픽
	public static Once(_topic: string): Promise<unknown>
	{
		return new Promise((_resolve) =>
		{
			const sub = EventBus.Subscribe(_topic, (_payload) =>
			{
				sub.Dispose();
				_resolve(_payload);
			});
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 패턴 매칭. *는 맨 끝 1개만.
	// @param _pattern: 패턴
	// @param _topic: 토픽
	private static Matches(_pattern: string, _topic: string): boolean
	{
		if (_pattern.endsWith("*"))
			return _topic.startsWith(_pattern.slice(0, -1));
		return _pattern === _topic;
	}
}
