/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: Terminal. 터미널식 로그 출력. 줄바꿈 wrap, 줄별 컬러, 자동 스크롤.
*/

import { UIProperty } from "../../Core/UIProperty";
import { Control } from "../Control";
import { RegisterElement } from "../RegisterElement";

export interface ITerminalLine
{
	Text: string;
	Color?: string;
}

@RegisterElement("Terminal")
export class Terminal extends Control
{
	// ==================== 정적 ====================
	public static readonly MaxLinesProperty = UIProperty.Register<number>("MaxLines", Terminal, { Default: 2000, Parse: (_text) => Number(_text) });

	// ==================== 멤버 ====================
	private lines_: HTMLDivElement[] = [];

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 스크롤 컨테이너를 만든다.
	public constructor()
	{
		super("div");
		const el = this.Element;
		el.classList.add("gui-terminal");
		el.style.display = "flex";
		el.style.flexDirection = "column";
		el.style.overflowY = "auto";
		el.style.overflowX = "hidden";
		el.style.background = "var(--background-base)";
		el.style.border = "1px solid var(--border-weak-base)";
		el.style.borderRadius = "4px";
		el.style.padding = "6px 8px";
		el.style.fontFamily = "var(--gui-font-mono, Consolas, monospace)";
		el.style.fontSize = "12px";
		el.style.color = "var(--text-base)";
		el.style.minHeight = "0";
	}

	// ==================== 속성 ====================
	public get MaxLines(): number { return this.GetValue(Terminal.MaxLinesProperty); }
	public set MaxLines(_v: number) { this.SetValue(Terminal.MaxLinesProperty, _v); }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 1줄 추가한다. Color 지정 가능.
	// @param _line: 줄
	public Append(_line: ITerminalLine): void
	{
		const div = document.createElement("div");
		div.textContent = _line.Text;
		div.style.whiteSpace = "pre-wrap";
		div.style.wordBreak = "break-all";
		div.style.lineHeight = "1.5";
		if (_line.Color !== undefined && _line.Color.length > 0)
			div.style.color = _line.Color;
		this.Element.appendChild(div);
		this.lines_.push(div);
		while (this.lines_.length > Math.max(1, this.MaxLines))
		{
			const old = this.lines_.shift();
			if (old !== undefined)
				old.remove();
		}
		this.Element.scrollTop = this.Element.scrollHeight;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 지운다.
	public Clear(): void
	{
		this.lines_ = [];
		this.Element.replaceChildren();
	}
}
