/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: UILayer. 레이어 div 1개 + 창 스택.
*/

import type { Window } from "./Window";

export enum UILayerKind
{
	Base = "Base",
	Dialog = "Dialog",
	Popup = "Popup",
	Toast = "Toast",
	Overlay = "Overlay",
}

export class UILayer
{
	// ==================== 멤버 ====================
	public readonly Kind: UILayerKind;
	public readonly Element: HTMLDivElement;
	private readonly windows_: Window[] = [];

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 레이어 div를 만든다. Base 외에는 pointer-events 없음.
	// @param _kind: 종류
	public constructor(_kind: UILayerKind)
	{
		this.Kind = _kind;
		this.Element = document.createElement("div");
		this.Element.className = "gui-layer";
		this.Element.dataset["layer"] = _kind;
	}

	// ==================== 속성 ====================
	public get Top(): Window | null { return this.windows_[this.windows_.length - 1] ?? null; }
	public get Count(): number { return this.windows_.length; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 창을 올린다.
	// @param _window: 창
	public Push(_window: Window): void
	{
		this.windows_.push(_window);
		this.Element.append(_window.Element);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 창을 내린다.
	// @param _window: 창
	public Remove(_window: Window): void
	{
		const idx = this.windows_.indexOf(_window);
		if (idx >= 0)
			this.windows_.splice(idx, 1);
		_window.Element.remove();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 내린다. 아래부터(먼저 올린 순).
	public Clear(): Window[]
	{
		const all = [...this.windows_];
		this.windows_.length = 0;
		for (const win of all)
			win.Element.remove();
		return all;
	}
}
