/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: MarkdownView. GFM 렌더 + 살균 + 링크 이벤트.
*/

import { marked } from "marked";
import createDOMPurify from "dompurify";
import type { Config } from "dompurify";
import { UIProperty } from "../../Core/UIProperty";
import { RoutedEvent, RoutedEventArgs, RoutingStrategy } from "../../Core/RoutedEvent";
import { Control } from "../Control";
import { RegisterElement } from "../RegisterElement";

export class LinkEventArgs extends RoutedEventArgs
{
	// ==================== 멤버 ====================
	public readonly Href: string;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 링크 인자로 만든다.
	// @param _source: 발신 요소
	// @param _href: 주소
	public constructor(_source: Control, _href: string)
	{
		super(_source);
		this.Href = _href;
	}
}

@RegisterElement("MarkdownView")
export class MarkdownView extends Control
{
	// ==================== 정적 ====================
	public static readonly SourceProperty = UIProperty.Register<string>("Source", MarkdownView, { Default: "" });

	// ==================== 멤버 ====================
	private readonly body_: HTMLDivElement;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 본문을 만든다.
	public constructor()
	{
		super();
		this.Element.classList.add("gui-markdown");
		this.body_ = document.createElement("div");
		this.body_.className = "gui-markdown__body";
		this.Element.append(this.body_);
	}

	// ==================== 속성 ====================
	public get Source(): string { return this.GetValue(MarkdownView.SourceProperty); }
	public set Source(_v: string) { this.SetValue(MarkdownView.SourceProperty, _v); }

	// ==================== 이벤트 ====================
	public readonly LinkRequested = new RoutedEvent<LinkEventArgs>("LinkRequested", RoutingStrategy.Bubble);

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 마크다운을 다시 그린다.
	// @param _md: 원문
	public RenderMarkdown(_md: string): void
	{
		const dirty = marked.parse(_md, { gfm: true, breaks: false, async: false });
		const clean = Purifier().sanitize(dirty, { ADD_ATTR: ["target"], FORBID_TAGS: ["style", "iframe"] });
		this.body_.replaceChildren(document.createRange().createContextualFragment(clean));
		for (const anchor of this.body_.querySelectorAll("a[href]"))
		{
			anchor.addEventListener("click", (_e) =>
			{
				_e.preventDefault();
				this.RaiseEvent(this.LinkRequested, new LinkEventArgs(this, anchor.getAttribute("href") ?? ""));
			});
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Source 변경을 DOM에 반영한다.
	// @param _prop: 속성
	// @param _value: 값
	protected override ApplyProperty(_prop: UIProperty<unknown>, _value: unknown): void
	{
		super.ApplyProperty(_prop, _value);
		if (_prop === MarkdownView.SourceProperty)
			this.RenderMarkdown(_value as string);
	}
}

//////////////////////////////////////////////////////////////////////////////////////
// 창 단위 살균기를 돌려준다. window 바인딩이 늦을 수 있어 지연 생성.
// @param _config: 살균 옵션
function Purifier(): { sanitize(_dirty: string, _config?: Config): string }
{
	if (cachedPurifier === null)
		cachedPurifier = createDOMPurify(window);
	return cachedPurifier;
}

let cachedPurifier: { sanitize(_dirty: string, _config?: Config): string } | null = null;
