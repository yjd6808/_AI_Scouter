/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ToolTipService. 문자열 툴팁을 작은 팝업으로.
*/

import { UIElement } from "../../Core/UIElement";
import { Popup } from "./Popup";
import { TextBlock } from "../TextBlock";

export class ToolTipService
{
	// ==================== 정적 ====================
	private static s_popup_: Popup | null = null;
	private static s_timer_: ReturnType<typeof setTimeout> | null = null;
	private static s_last_: number = 0;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 요소에 커스텀 툴팁을 건다. 문자열 ToolTip 속성과 함께 쓴다.
	// @param _element: 요소
	public static Attach(_element: UIElement): void
	{
		_element.Element.addEventListener("pointerenter", () =>
		{
			ToolTipService.Schedule(_element);
		});
		_element.Element.addEventListener("pointerleave", () =>
		{
			ToolTipService.Cancel();
		});
		_element.Element.addEventListener("pointerdown", () =>
		{
			ToolTipService.Cancel();
		});
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시를 예약한다. 400ms, 연속이면 100ms.
	// @param _element: 요소
	private static Schedule(_element: UIElement): void
	{
		ToolTipService.Cancel();
		const text = _element.ToolTip;
		if (text.length === 0)
			return;
		const wait = Date.now() - ToolTipService.s_last_ < 1000 ? 100 : 400;
		ToolTipService.s_timer_ = setTimeout(() =>
		{
			ToolTipService.s_timer_ = null;
			ToolTipService.s_last_ = Date.now();
			ToolTipService.Show(_element, text);
		}, wait);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약을 취소하고 숨긴다.
	private static Cancel(): void
	{
		if (ToolTipService.s_timer_ !== null)
		{
			clearTimeout(ToolTipService.s_timer_);
			ToolTipService.s_timer_ = null;
		}
		if (ToolTipService.s_popup_ !== null)
		{
			ToolTipService.s_popup_.IsOpen = false;
			ToolTipService.s_popup_ = null;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 팝업으로 보여준다.
	// @param _element: 앵커
	// @param _text: 내용
	private static Show(_element: UIElement, _text: string): void
	{
		const popup = new Popup();
		const label = new TextBlock();
		label.Text = _text;
		popup.AddChild(label);
		popup.PlacementTarget = _element;
		popup.StaysOpen = false;
		ToolTipService.s_popup_ = popup;
		popup.IsOpen = true;
	}
}
