/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: SelectionModel. Primary·Anchor·diff 계산.
*/

export interface ISelectionDiff
{
	Added: number[];
	Removed: number[];
	IsEmpty: boolean;
}

export class SelectionModel
{
	// ==================== 멤버 ====================
	private indices_ = new Set<number>();
	private anchor_ = -1;

	// ==================== 속성 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 마지막 선택 인덱스를 읽는다. 없으면 -1.
	public get Primary(): number
	{
		let max = -1;
		for (const idx of this.indices_)
		{
			if (idx > max)
				max = idx;
		}
		return max;
	}

	public get Anchor(): number { return this.anchor_; }
	public get Indices(): number[] { return [...this.indices_].sort((_a, _b) => _a - _b); }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택을 교체한다. Anchor도 갱신.
	// @param _indices: 새 인덱스
	public Replace(_indices: number[]): ISelectionDiff
	{
		const next = new Set(_indices.filter((_i) => _i >= 0));
		const added = [...next].filter((_i) => !this.indices_.has(_i));
		const removed = [...this.indices_].filter((_i) => !next.has(_i));
		this.indices_ = next;
		if (_indices.length > 0)
			this.anchor_ = _indices[_indices.length - 1] as number;
		else
			this.anchor_ = -1;
		return { Added: added, Removed: removed, IsEmpty: added.length === 0 && removed.length === 0 };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 토글한다.
	// @param _index: 인덱스
	public Toggle(_index: number): ISelectionDiff
	{
		if (_index < 0)
			return { Added: [], Removed: [], IsEmpty: true };
		if (this.indices_.has(_index))
		{
			this.indices_.delete(_index);
			return { Added: [], Removed: [_index], IsEmpty: false };
		}
		this.indices_.add(_index);
		this.anchor_ = _index;
		return { Added: [_index], Removed: [], IsEmpty: false };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Anchor~index 범위를 선택한다.
	// @param _index: 끝점
	public Range(_index: number): ISelectionDiff
	{
		const anchor = this.anchor_ < 0 ? _index : this.anchor_;
		const lo = Math.min(anchor, _index);
		const hi = Math.max(anchor, _index);
		const range: number[] = [];
		for (let idx = lo; idx <= hi; ++idx)
			range.push(idx);
		return this.Replace(range);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전부 지운다.
	public Clear(): ISelectionDiff
	{
		return this.Replace([]);
	}
}
