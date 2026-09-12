/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ToolBar. 가로 버튼 막대 + 오버플로우.
*/

import { Button } from "../Button";
import { RegisterElement } from "../RegisterElement";
import { ItemsControl } from "./ItemsControl";
import { Popup } from "./Popup";

@RegisterElement("ToolBar")
export class ToolBar extends ItemsControl
{
	// ==================== 멤버 ====================
	private readonly overflow_ = new Popup();
	private overflowButton_: Button | null = null;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 막대를 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-toolbar");
		this.Element.setAttribute("role", "toolbar");
		this.overflow_.StaysOpen = false;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 넘치는 항목을 » 팝업에 모은다. 넘침이 없으면 버튼 숨김.
	public UpdateOverflow(): void
	{
		const over = this.Element.scrollWidth > this.Element.clientWidth + 1;
		if (!over)
		{
			if (this.overflowButton_ !== null)
			{
				this.overflowButton_.Element.remove();
				this.overflowButton_ = null;
			}
			this.overflow_.IsOpen = false;
			return;
		}
		if (this.overflowButton_ === null)
		{
			const button = new Button();
			button.Content = "»";
			button.Variant = "Ghost";
			button.Click.Add(() =>
			{
				this.OpenOverflow();
			});
			this.overflowButton_ = button;
			this.Element.append(button.Element);
			this.overflow_.Closed.Add(() =>
			{
				this.CloseOverflow();
			});
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 항목을 팝업으로 옮겨 연다.
	private OpenOverflow(): void
	{
		for (const child of [...this.Children])
		{
			if (child === this.overflowButton_)
				continue;
			this.RemoveChild(child, false);
			this.overflow_.AddChild(child);
		}
		this.overflow_.IsOpen = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 팝업 항목을 막대로 되돌린다.
	private CloseOverflow(): void
	{
		for (const child of [...this.overflow_.Children])
		{
			this.overflow_.RemoveChild(child, false);
			if (this.overflowButton_ !== null)
				this.Element.insertBefore(child.Element, this.overflowButton_.Element);
			else
				this.AddChild(child);
		}
	}
}
