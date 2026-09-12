/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 경량 이벤트. UIElement가 아닌 주체(DataList 등)가 쓴다.
*/

import type { IDisposable } from "./Disposable";

export class SimpleEvent<T>
{
	// ==================== 멤버 ====================
	private readonly handlers_ = new Set<(_args: T) => void>();

	// ==================== 속성 ====================
	public get HasHandlers(): boolean { return this.handlers_.size > 0; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 구독한다. 반환 Disposable로 해제.
	// @param _handler: 핸들러
	public Add(_handler: (_args: T) => void): IDisposable
	{
		this.handlers_.add(_handler);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				this.handlers_.delete(_handler);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 핸들러를 호출한다. 예외는 격리하고 다음으로.
	// @param _args: 인자
	public Invoke(_args: T): void
	{
		for (const handler of [...this.handlers_])
		{
			try
			{
				handler(_args);
			}
			catch
			{
				continue;
			}
		}
	}
}
