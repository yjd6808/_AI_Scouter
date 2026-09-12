/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: DOM ↔ UIElement 역참조. WeakMap이라 GC 친화적이다.
*/

import type { UIElement } from "./UIElement";

export class ElementRegistry
{
	// ==================== 정적 ====================
	private static readonly s_map_ = new WeakMap<Element, UIElement>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// DOM과 요소를 묶는다.
	// @param _dom: DOM 노드
	// @param _element: 요소
	public static Bind(_dom: Element, _element: UIElement): void
	{
		ElementRegistry.s_map_.set(_dom, _element);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 묶음을 푼다.
	// @param _dom: DOM 노드
	public static Unbind(_dom: Element): void
	{
		ElementRegistry.s_map_.delete(_dom);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// DOM에서 요소를 찾는다. 없으면 null.
	// @param _dom: DOM 노드
	public static FromDom(_dom: Element | null): UIElement | null
	{
		if (_dom === null)
			return null;
		return ElementRegistry.s_map_.get(_dom) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이벤트 target에서 가장 가까운 등록 요소를 찾는다. 미등록 중간 div는 건너뛴다.
	// @param _target: 이벤트 target
	public static FromEventTarget(_target: EventTarget | null): UIElement | null
	{
		let node: Node | null = _target as Node | null;
		while (node !== null)
		{
			if (node instanceof Element)
			{
				const found = ElementRegistry.s_map_.get(node);
				if (found !== undefined)
					return found;
			}
			node = node.parentNode;
		}
		return null;
	}
}
