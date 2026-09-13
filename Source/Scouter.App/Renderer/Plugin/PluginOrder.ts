/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: PluginOrder. 사이드바 순서 확정·정렬기준 계산. DOM·Settings 없이 순수 계산만.
*/

export type TSidebarSort = "Custom" | "MostClicked" | "Oldest";

export interface IOrderEntry
{
	Id: string;
	Name: string;
}

export class PluginOrder
{
	// ==================== 정적 ====================
	private static s_collator_: Intl.Collator | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 알파벳을 비교한다. ko 기준.
	// @param _a: 왼쪽
	// @param _b: 오른쪽
	public static CompareAlpha(_a: string, _b: string): number
	{
		return PluginOrder.Collator().compare(_a, _b);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 시스템(내장) 영역을 정렬한다. 무조건 이름 알파벳순.
	// @param _items: 항목
	public static SortBuiltIn<T extends IOrderEntry>(_items: T[]): T[]
	{
		return [..._items].sort((_a, _b) => PluginOrder.CompareAlpha(_a.Name, _b.Name) || PluginOrder.CompareAlpha(_a.Id, _b.Id));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 외부 영역 order를 확정한다. 최초면 알파벳, 저장 순서는 유지, 신규는 알파벳 위치에 삽입.
	// 사라진 Id도 유지한다. 리로드 중 일시 제거와 실제 삭제를 구분할 수 없기 때문이다.
	// @param _order: 저장된 순서
	// @param _externalIds: 현재 외부 Id
	public static EnsureExternalOrder(_order: string[], _externalIds: string[]): string[]
	{
		const out = [...new Set(_order)];
		const have = new Set(out);
		const fresh = _externalIds.filter((_id) => !have.has(_id)).sort((_a, _b) => PluginOrder.CompareAlpha(_a, _b));
		for (const id of fresh)
		{
			let placed = false;
			for (let idx = 0; idx < out.length; ++idx)
			{
				if (PluginOrder.CompareAlpha(id, out[idx] as string) < 0)
				{
					out.splice(idx, 0, id);
					placed = true;
					break;
				}
			}
			if (!placed)
				out.push(id);
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 외부 영역 표시 순서를 정한다. 정렬기준이 order를 덮는다.
	// @param _items: 외부 항목
	// @param _order: 확정 순서
	// @param _clicks: Id별 클릭 수
	// @param _seen: Id별 최초 확인 시각(ms)
	// @param _sort: 정렬기준
	public static SortExternal<T extends IOrderEntry>(_items: T[], _order: string[], _clicks: Record<string, number>, _seen: Record<string, number>, _sort: TSidebarSort): T[]
	{
		if (_sort === "MostClicked")
		{
			return [..._items].sort((_a, _b) =>
				((_clicks[_b.Id] ?? 0) - (_clicks[_a.Id] ?? 0))
				|| PluginOrder.CompareAlpha(_a.Name, _b.Name)
				|| PluginOrder.CompareAlpha(_a.Id, _b.Id));
		}
		if (_sort === "Oldest")
		{
			const ageOf = (_id: string): number => _seen[_id] ?? Number.MAX_SAFE_INTEGER;
			return [..._items].sort((_a, _b) =>
				(ageOf(_a.Id) - ageOf(_b.Id))
				|| PluginOrder.CompareAlpha(_a.Name, _b.Name)
				|| PluginOrder.CompareAlpha(_a.Id, _b.Id));
		}
		const rank = new Map(_order.map((_id, _idx) => [_id, _idx] as [string, number]));
		return [..._items].sort((_a, _b) =>
			((rank.get(_a.Id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(_b.Id) ?? Number.MAX_SAFE_INTEGER))
			|| PluginOrder.CompareAlpha(_a.Name, _b.Name)
			|| PluginOrder.CompareAlpha(_a.Id, _b.Id));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 최초 확인 시각을 채운다. 이미 있으면 손대지 않는다.
	// @param _seen: 기존 기록
	// @param _ids: 현재 Id
	// @param _now: 지금 시각(ms)
	public static EnsureFirstSeen(_seen: Record<string, number>, _ids: string[], _now: number): Record<string, number>
	{
		const out: Record<string, number> = { ..._seen };
		for (const id of _ids)
		{
			if (out[id] === undefined)
				out[id] = _now;
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 정렬기준 값을 굳힌다. 모르면 사용자 순서.
	// @param _value: 저장값
	public static NormalizeSort(_value: unknown): TSidebarSort
	{
		if (_value === "MostClicked" || _value === "Oldest")
			return _value;
		return "Custom";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 정렬기준 표시 이름.
	// @param _sort: 정렬기준
	public static SortLabel(_sort: TSidebarSort): string
	{
		if (_sort === "MostClicked")
			return "클릭 많은 순";
		if (_sort === "Oldest")
			return "오래된 순";
		return "사용자 순서";
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 공용 Collator를 구한다.
	private static Collator(): Intl.Collator
	{
		if (PluginOrder.s_collator_ === null)
			PluginOrder.s_collator_ = new Intl.Collator("ko");
		return PluginOrder.s_collator_;
	}
}
