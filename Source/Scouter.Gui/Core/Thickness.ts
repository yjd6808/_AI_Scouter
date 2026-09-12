/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 두께 값. Margin·Padding·BorderThickness 공용.
*/

export class Thickness
{
	// ==================== 멤버 ====================
	public readonly Left: number;
	public readonly Top: number;
	public readonly Right: number;
	public readonly Bottom: number;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 네 방향 값을 받는다.
	// @param _left: 좌
	// @param _top: 상
	// @param _right: 우
	// @param _bottom: 하
	public constructor(_left: number, _top: number, _right: number, _bottom: number)
	{
		this.Left = _left;
		this.Top = _top;
		this.Right = _right;
		this.Bottom = _bottom;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// "8" / "8,4" / "8,4,8,4" 형식을 파싱한다.
	// @param _text: 원문
	public static Parse(_text: string): Thickness
	{
		const parts = _text.split(",").map((_p) => Number(_p.trim()));
		if (parts.some((_p) => Number.isNaN(_p)))
			throw new Error(`[Thickness] 파싱 실패: ${_text}`);
		if (parts.length === 1)
			return new Thickness(parts[0] as number, parts[0] as number, parts[0] as number, parts[0] as number);
		if (parts.length === 2)
			return new Thickness(parts[0] as number, parts[1] as number, parts[0] as number, parts[1] as number);
		if (parts.length === 4)
			return new Thickness(parts[0] as number, parts[1] as number, parts[2] as number, parts[3] as number);
		throw new Error(`[Thickness] 파싱 실패: ${_text}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// CSS margin/padding 문자열로 변환한다.
	public ToCss(): string
	{
		return `${this.Top}px ${this.Right}px ${this.Bottom}px ${this.Left}px`;
	}
}
