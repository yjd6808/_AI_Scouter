/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: ScrollbarTheme. 앱 전체 스크롤바를 테마 토큰으로 칠한다.
	Chromium은 ::-webkit-scrollbar 의사요소에서 var()를 해석하지 못하므로
	해석済み 토큰 값으로 규칙을 직접 만든다. ThemeManager.Render에서 호출.
*/

export class ScrollbarTheme
{
	// ==================== 정적 ====================
	private static readonly s_styleId_ = "scouter-scrollbar";
	private static s_style_: HTMLStyleElement | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 토큰으로 스크롤바 CSS를 만들어 적용한다.
	// @param _tokens: 해석된 토큰
	public static Apply(_tokens: Map<string, string>): void
	{
		let style: HTMLStyleElement | null = ScrollbarTheme.s_style_;
		if (style === null)
		{
			const hit = document.getElementById(ScrollbarTheme.s_styleId_);
			if (hit instanceof HTMLStyleElement)
			{
				style = hit;
			}
			else
			{
				const el = document.createElement("style");
				el.id = ScrollbarTheme.s_styleId_;
				document.head.append(el);
				style = el;
			}
			ScrollbarTheme.s_style_ = style;
		}
		style.textContent = ScrollbarTheme.Build(_tokens);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 규칙 문자열을 만든다.
	// @param _tokens: 해석된 토큰
	private static Build(_tokens: Map<string, string>): string
	{
		const pick = (_key: string, _fallback: string): string =>
		{
			const value = _tokens.get(_key);
			return value !== undefined && value.length > 0 ? value : _fallback;
		};
		const thumb = pick("border", "#3c3c3c");
		const hover = pick("text-weak", "#8c8c8c");
		const tags = ["div", "textarea", "body"];
		const rule = (_pseudo: string, _body: string): string =>
			tags.map((_tag) => `${_tag}${_pseudo}{${_body}}`).join("");
		return rule("::-webkit-scrollbar", "width:10px;height:10px")
			+ rule("::-webkit-scrollbar-track", "background:transparent")
			+ rule("::-webkit-scrollbar-thumb", `background:${thumb};border-radius:5px;border:2px solid transparent;background-clip:content-box`)
			+ rule("::-webkit-scrollbar-thumb:hover", `background:${hover};border:2px solid transparent;background-clip:content-box`)
			+ rule("::-webkit-scrollbar-corner", "background:transparent");
	}
}
