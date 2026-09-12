/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 공유 ResizeObserver 1개. 요소마다 생성하지 않고 observe/unobserve만 한다.
*/

import { ElementRegistry } from "./ElementRegistry";

export class SizeObserver
{
	// ==================== 정적 ====================
	private static s_observer_: ResizeObserver | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 관찰을 시작한다.
	// @param _element: UIElement (Element 프로퍼티 사용)
	public static Observe(_element: { Element: HTMLElement }): void
	{
		SizeObserver.Ensure();
		(SizeObserver.s_observer_ as ResizeObserver).observe(_element.Element);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 관찰을 중단한다.
	// @param _element: UIElement
	public static Unobserve(_element: { Element: HTMLElement }): void
	{
		if (SizeObserver.s_observer_ === null)
			return;
		SizeObserver.s_observer_.unobserve(_element.Element);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 싱글턴 옵저버를 만든다. 콜백은 요소를 찾아 NotifySizeChanged를 호출한다.
	private static Ensure(): void
	{
		if (SizeObserver.s_observer_ !== null)
			return;
		SizeObserver.s_observer_ = new ResizeObserver((_entries) =>
		{
			for (const entry of _entries)
			{
				const found = ElementRegistry.FromDom(entry.target);
				if (found === null)
					continue;
				const rect = entry.contentRect;
				found.NotifySizeChanged(rect.width, rect.height);
			}
		});
	}
}
