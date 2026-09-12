/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RingBuffer. 고정 용량 순환 보관.
*/

export class RingBuffer<T>
{
	// ==================== 멤버 ====================
	private readonly capacity_: number;
	private readonly items_: T[] = [];
	private start_ = 0;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 용량으로 만든다.
	// @param _capacity: 최대 개수
	public constructor(_capacity: number)
	{
		this.capacity_ = Math.max(1, _capacity);
	}

	// ==================== 속성 ====================
	public get Count(): number { return this.items_.length; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 1건을 넣는다. 넘치면 가장 오래된 것을 덮는다.
	// @param _item: 항목
	public Push(_item: T): void
	{
		if (this.items_.length < this.capacity_)
		{
			this.items_.push(_item);
			return;
		}
		this.items_[this.start_] = _item;
		this.start_ = (this.start_ + 1) % this.capacity_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 오래된 순 인덱스로 읽는다.
	// @param _index: 인덱스
	public Get(_index: number): T
	{
		if (_index < 0 || _index >= this.items_.length)
			throw new Error(`[RingBuffer] 범위 밖: ${_index}`);
		if (this.items_.length < this.capacity_)
			return this.items_[_index] as T;
		return this.items_[(this.start_ + _index) % this.capacity_] as T;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 지운다.
	public Clear(): void
	{
		this.items_.length = 0;
		this.start_ = 0;
	}
}
