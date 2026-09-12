/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RecentStore. 최근 사용 가중치. 지수 감소.
*/

interface IRecentEntry
{
	Count: number;
	LastAt: number;
}

export interface IRecentStorage
{
	Get<T>(_key: string, _def: T): T;
	Set(_key: string, _value: unknown): void;
}

const kDayMs = 86400000;

export class RecentStore
{
	// ==================== 멤버 ====================
	private readonly storage_: IRecentStorage;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소로 만든다.
	// @param _storage: Plugin Storage
	public constructor(_storage: IRecentStorage)
	{
		this.storage_ = _storage;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용 1회를 기록한다.
	// @param _name: 항목 이름
	public Bump(_name: string): void
	{
		const all = this.storage_.Get<Record<string, IRecentEntry>>("recent", {});
		const prev = all[_name] ?? { Count: 0, LastAt: 0 };
		all[_name] = { Count: prev.Count + 1, LastAt: Date.now() };
		this.storage_.Set("recent", all);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 가중치를 구한다. 횟수 × 지수 감소. 미사용이면 0.
	// @param _name: 항목 이름
	public Weight(_name: string): number
	{
		const all = this.storage_.Get<Record<string, IRecentEntry>>("recent", {});
		const found = all[_name];
		if (found === undefined)
			return 0;
		const ageDays = (Date.now() - found.LastAt) / kDayMs;
		return found.Count * Math.exp(-ageDays);
	}
}
