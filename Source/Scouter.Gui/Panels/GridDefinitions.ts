/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Grid 행/열 정의. Star·Auto·Pixel을 CSS로 번역한다.
*/

export enum GridUnitType
{
	Auto = "Auto",
	Pixel = "Pixel",
	Star = "Star",
}

export class GridLength
{
	// ==================== 멤버 ====================
	public readonly Value: number;
	public readonly Unit: GridUnitType;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 값·단위로 만든다.
	// @param _value: 값
	// @param _unit: 단위
	public constructor(_value: number, _unit: GridUnitType)
	{
		this.Value = _value;
		this.Unit = _unit;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// "*", "2*", "Auto", "150"을 파싱한다.
	// @param _text: 원문
	public static Parse(_text: string): GridLength
	{
		const trimmed = _text.trim();
		if (trimmed === "Auto")
			return new GridLength(0, GridUnitType.Auto);
		if (trimmed === "*")
			return new GridLength(1, GridUnitType.Star);
		if (trimmed.endsWith("*"))
		{
			const num = Number(trimmed.slice(0, -1));
			if (!Number.isNaN(num))
				return new GridLength(num, GridUnitType.Star);
		}
		const num = Number(trimmed);
		if (!Number.isNaN(num))
			return new GridLength(num, GridUnitType.Pixel);
		throw new Error(`[GridLength] 파싱 실패: ${_text}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Pixel 고정값을 만든다. GridSplitter 드래그용.
	// @param _px: 픽셀
	public static Pixel(_px: number): GridLength
	{
		return new GridLength(_px, GridUnitType.Pixel);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// CSS 트랙 문자열로 변환한다.
	// @param _min: 최소 px
	// @param _max: 최대 px (GridSplitter clamp용, CSS는 min만 반영)
	public ToCss(_min: number, _max: number): string
	{
		switch (this.Unit)
		{
			case GridUnitType.Auto: return "auto";
			case GridUnitType.Pixel: return `${Math.min(Math.max(this.Value, _min), _max)}px`;
			case GridUnitType.Star: return `minmax(${_min}px, ${this.Value}fr)`;
			default: throw new Error("[GridLength] 알 수 없는 단위");
		}
	}
}

export class RowDefinition
{
	// ==================== 멤버 ====================
	public Length: GridLength;
	public MinHeight: number;
	public MaxHeight: number;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 높이 정의 1개를 만든다.
	// @param _length: 길이
	public constructor(_length: GridLength)
	{
		this.Length = _length;
		this.MinHeight = 0;
		this.MaxHeight = Number.POSITIVE_INFINITY;
	}

	// ==================== 속성 ====================
	public get ActualHeight(): number { return 0; }
}

export class ColumnDefinition
{
	// ==================== 멤버 ====================
	public Length: GridLength;
	public MinWidth: number;
	public MaxWidth: number;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 너비 정의 1개를 만든다.
	// @param _length: 길이
	public constructor(_length: GridLength)
	{
		this.Length = _length;
		this.MinWidth = 0;
		this.MaxWidth = Number.POSITIVE_INFINITY;
	}

	// ==================== 속성 ====================
	public get ActualWidth(): number { return 0; }
}

export class DefinitionCollection<T extends RowDefinition | ColumnDefinition>
{
	// ==================== 멤버 ====================
	private readonly items_: T[] = [];
	private readonly changed_: Array<() => void> = [];

	// ==================== 속성 ====================
	public get Count(): number { return this.items_.length; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 변경 구독. Grid가 템플릿 무효화에 쓴다.
	// @param _handler: 핸들러
	public AddChanged(_handler: () => void): void
	{
		this.changed_.push(_handler);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인덱스로 구한다.
	// @param _index: 인덱스
	public Get(_index: number): T
	{
		const found = this.items_[_index];
		if (found === undefined)
			throw new Error(`[DefinitionCollection] 범위 밖: ${_index}`);
		return found;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 끝에 추가한다.
	// @param _def: 정의
	public Add(_def: T): void
	{
		this.items_.push(_def);
		this.NotifyChanged();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 위치에 끼운다.
	// @param _index: 위치
	// @param _def: 정의
	public Insert(_index: number, _def: T): void
	{
		this.items_.splice(_index, 0, _def);
		this.NotifyChanged();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 위치를 지운다.
	// @param _index: 위치
	public RemoveAt(_index: number): void
	{
		this.items_.splice(_index, 1);
		this.NotifyChanged();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 지운다.
	public Clear(): void
	{
		this.items_.length = 0;
		this.NotifyChanged();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// "Auto,*,2*,150" 축약 문법을 파싱한다.
	// @param _text: 원문
	// @param _create: 항목 생성기
	public Parse(_text: string, _create: (_length: GridLength) => T): void
	{
		this.items_.length = 0;
		for (const part of _text.split(","))
		{
			if (part.trim().length === 0)
				continue;
			this.items_.push(_create(GridLength.Parse(part)));
		}
		this.NotifyChanged();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 구독자에게 알린다.
	private NotifyChanged(): void
	{
		for (const handler of [...this.changed_])
			handler();
	}
}
