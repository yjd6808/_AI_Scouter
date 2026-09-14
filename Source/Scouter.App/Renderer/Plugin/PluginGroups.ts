/*
	작성자: 윤정도
	생성일: 2026-09-14
	=====
	설명: PluginGroups. 사이드바 그룹 구조(영역 → 그룹 → 항목)를 계산한다. DOM·Settings 없이 순수 계산만.
	영역은 System(내장)·External(외부) 2개이고, 각 영역은 고정 그룹 기본·숨겨짐 + 사용자 그룹으로 이뤄진다.
	변경 계열 메서드는 입력을 건드리지 않고 새 상태를 반환한다. 거부되면 입력을 그대로(같은 참조로) 돌려준다.
*/

import type { IOrderEntry, TSidebarSort } from "./PluginOrder";
import { PluginOrder } from "./PluginOrder";

export type TPluginGroupArea = "System" | "External";
export type TPluginGroupKind = "Fixed" | "User";

export interface IPluginGroup
{
	Id: string;
	Name: string;
	Kind: TPluginGroupKind;
	Collapsed: boolean;
	Items: string[];
}

export interface IPluginGroupState
{
	System: IPluginGroup[];
	External: IPluginGroup[];
}

export class PluginGroups
{
	// ==================== 정적 ====================
	public static readonly DefaultGroupId = "default";
	public static readonly HiddenGroupId = "hidden";
	public static readonly DefaultGroupName = "기본";
	public static readonly HiddenGroupName = "숨겨짐";
	public static readonly NewGroupPrefix = "group-";
	private static readonly s_areas_: TPluginGroupArea[] = ["System", "External"];

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin 출처로 영역을 구한다. BuiltIn만 시스템, 나머지는 전부 외부.
	// @param _source: Plugin 출처 문자열
	public static AreaOf(_source: string): TPluginGroupArea
	{
		return _source === "BuiltIn" ? "System" : "External";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고정 그룹인지 본다. 고정이면 이름변경·삭제 불가(순서 변경은 가능).
	// @param _groupId: 그룹 Id
	public static IsFixedGroup(_groupId: string): boolean
	{
		return _groupId === PluginGroups.DefaultGroupId || _groupId === PluginGroups.HiddenGroupId;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 숨김 그룹인지 본다. 이 그룹은 기본 접힘이고 검색(필터) 대상에서 뺀다.
	// @param _groupId: 그룹 Id
	public static IsHiddenGroup(_groupId: string): boolean
	{
		return _groupId === PluginGroups.HiddenGroupId;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 빈 기본 구조를 만든다. 두 영역 모두 고정 그룹 2개만 가진다.
	public static Empty(): IPluginGroupState
	{
		return { System: PluginGroups.FixedPair(), External: PluginGroups.FixedPair() };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹을 찾는다. 없으면 null.
	// @param _state: 그룹 상태
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	public static FindGroup(_state: IPluginGroupState, _area: TPluginGroupArea, _groupId: string): IPluginGroup | null
	{
		return _state[_area].find((_group) => _group.Id === _groupId) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장값(신뢰 불가)을 정규화한다. 고정 그룹 보강, 중복 정리, 영역 교정, 신규 삽입까지 한 번에 한다.
	// 현재 목록에 없는 Id는 지우지 않는다. 리로드 중 일시 제거와 실제 삭제를 구분할 수 없기 때문이다.
	// @param _raw: 저장된 값
	// @param _systemIds: 현재 시스템(내장) Plugin Id
	// @param _externalIds: 현재 외부 Plugin Id
	public static Normalize(_raw: unknown, _systemIds: string[], _externalIds: string[]): IPluginGroupState
	{
		const state: IPluginGroupState =
		{
			System: PluginGroups.ReadArea(_raw, "System"),
			External: PluginGroups.ReadArea(_raw, "External"),
		};
		const systemSet = new Set(_systemIds);
		const externalSet = new Set(_externalIds);
		for (const area of PluginGroups.s_areas_)
		{
			for (const group of state[area])
				group.Items = group.Items.filter((_id) => (PluginGroups.OwnerOf(_id, systemSet, externalSet) ?? area) === area);
		}
		const seen = new Set<string>();
		for (const area of PluginGroups.s_areas_)
		{
			for (const group of state[area])
			{
				const kept: string[] = [];
				for (const id of group.Items)
				{
					if (seen.has(id))
						continue;
					seen.add(id);
					kept.push(id);
				}
				group.Items = kept;
			}
		}
		PluginGroups.InsertFresh(state.System, _systemIds);
		PluginGroups.InsertFresh(state.External, _externalIds);
		return state;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기존 Ui.PluginOrder를 외부 영역 기본 그룹 순서로 옮긴다. 업데이트해도 순서를 잃지 않게 한다.
	// 시스템 영역은 비워서 돌려주고, 이후 Normalize가 실제 Id로 채운다.
	// @param _order: 기존 사용자 순서
	// @param _externalIds: 현재 외부 Plugin Id
	public static MigrateFromOrder(_order: string[], _externalIds: string[]): IPluginGroupState
	{
		const state = PluginGroups.Empty();
		const home = state.External[0];
		if (home !== undefined)
			home.Items = PluginOrder.EnsureExternalOrder(_order, _externalIds);
		return PluginGroups.Normalize(state, [], _externalIds);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이관이 필요한 저장값인지 본다. 값이 깨졌거나 모든 그룹이 비어 있으면 이관 대상이다.
	// @param _raw: 저장된 값
	public static NeedsMigration(_raw: unknown): boolean
	{
		const root = PluginGroups.AsRecord(_raw);
		if (root === null)
			return true;
		for (const area of PluginGroups.s_areas_)
		{
			const list: unknown = root[area];
			if (!Array.isArray(list))
				return true;
			for (const entry of list as unknown[])
			{
				const group = PluginGroups.ReadGroup(entry);
				if (group !== null && group.Items.length > 0)
					return false;
			}
		}
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 항목을 그룹 간·그룹 내로 옮긴다. 항목이 그 영역에 없거나 대상 그룹이 없으면 거부(입력 그대로 반환).
	// 영역을 넘는 이동은 항목이 해당 영역에 없으므로 자연히 거부된다.
	// @param _state: 그룹 상태
	// @param _area: 영역
	// @param _itemId: 옮길 Plugin Id
	// @param _targetGroupId: 대상 그룹 Id
	// @param _index: 대상 그룹에서 제거 후 기준 삽입 위치. 범위를 벗어나면 맨 뒤.
	public static MoveItem(_state: IPluginGroupState, _area: TPluginGroupArea, _itemId: string, _targetGroupId: string, _index: number): IPluginGroupState
	{
		const next = PluginGroups.CloneArea(_state, _area);
		const from = next.find((_group) => _group.Items.includes(_itemId));
		const to = next.find((_group) => _group.Id === _targetGroupId);
		if (from === undefined || to === undefined)
			return _state;
		from.Items = from.Items.filter((_id) => _id !== _itemId);
		to.Items.splice(PluginGroups.ClampIndex(_index, to.Items.length), 0, _itemId);
		return PluginGroups.WithArea(_state, _area, next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용자 그룹을 맨 뒤에 추가한다. 이름이 비면 거부(입력 그대로 반환). Id는 영역 안에서 충돌하지 않게 만든다.
	// @param _state: 그룹 상태
	// @param _area: 영역
	// @param _name: 그룹 이름
	public static AddGroup(_state: IPluginGroupState, _area: TPluginGroupArea, _name: string): IPluginGroupState
	{
		const name = _name.trim();
		if (name === "")
			return _state;
		const next = PluginGroups.CloneArea(_state, _area);
		next.push({ Id: PluginGroups.NewGroupId(next), Name: name, Kind: "User", Collapsed: false, Items: [] });
		return PluginGroups.WithArea(_state, _area, next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 이름을 바꾼다. 고정 그룹·없는 그룹·빈 이름은 거부(입력 그대로 반환).
	// @param _state: 그룹 상태
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	// @param _name: 새 이름
	public static RenameGroup(_state: IPluginGroupState, _area: TPluginGroupArea, _groupId: string, _name: string): IPluginGroupState
	{
		const name = _name.trim();
		if (name === "" || PluginGroups.IsFixedGroup(_groupId))
			return _state;
		const next = PluginGroups.CloneArea(_state, _area);
		const target = next.find((_group) => _group.Id === _groupId);
		if (target === undefined || target.Kind === "Fixed")
			return _state;
		target.Name = name;
		return PluginGroups.WithArea(_state, _area, next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용자 그룹을 지운다. 고정 그룹·없는 그룹은 거부(입력 그대로 반환).
	// 안에 있던 항목은 같은 영역 기본 그룹 맨 뒤로 회수한다. 순서를 최대한 살리기 위해서다.
	// @param _state: 그룹 상태
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	public static RemoveGroup(_state: IPluginGroupState, _area: TPluginGroupArea, _groupId: string): IPluginGroupState
	{
		if (PluginGroups.IsFixedGroup(_groupId))
			return _state;
		const next = PluginGroups.CloneArea(_state, _area);
		const at = next.findIndex((_group) => _group.Id === _groupId);
		const target = next[at];
		const home = next.find((_group) => _group.Id === PluginGroups.DefaultGroupId);
		if (at < 0 || target === undefined || target.Kind === "Fixed" || home === undefined)
			return _state;
		next.splice(at, 1);
		for (const id of target.Items)
		{
			if (!home.Items.includes(id))
				home.Items.push(id);
		}
		return PluginGroups.WithArea(_state, _area, next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 순서를 바꾼다. 고정 그룹도 옮길 수 있다. 없는 그룹은 거부(입력 그대로 반환).
	// @param _state: 그룹 상태
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	// @param _index: 제거 후 기준 삽입 위치. 범위를 벗어나면 맨 뒤.
	public static MoveGroup(_state: IPluginGroupState, _area: TPluginGroupArea, _groupId: string, _index: number): IPluginGroupState
	{
		const next = PluginGroups.CloneArea(_state, _area);
		const at = next.findIndex((_group) => _group.Id === _groupId);
		if (at < 0)
			return _state;
		const moved = next.splice(at, 1)[0];
		if (moved === undefined)
			return _state;
		next.splice(PluginGroups.ClampIndex(_index, next.length), 0, moved);
		return PluginGroups.WithArea(_state, _area, next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 접힘 상태를 바꾼다. 없는 그룹은 거부(입력 그대로 반환).
	// @param _state: 그룹 상태
	// @param _area: 영역
	// @param _groupId: 그룹 Id
	// @param _collapsed: 접을지 여부
	public static SetCollapsed(_state: IPluginGroupState, _area: TPluginGroupArea, _groupId: string, _collapsed: boolean): IPluginGroupState
	{
		const next = PluginGroups.CloneArea(_state, _area);
		const target = next.find((_group) => _group.Id === _groupId);
		if (target === undefined)
			return _state;
		target.Collapsed = _collapsed;
		return PluginGroups.WithArea(_state, _area, next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 안 나열 순서를 정한다. 그룹 구조·그룹 순서는 건드리지 않고 정렬기준을 그룹 안에만 적용한다.
	// 비교 규칙은 PluginOrder.SortExternal을 그대로 쓴다. 그룹 Items가 사용자 순서 역할을 한다.
	// @param _group: 대상 그룹
	// @param _items: 전체 항목(다른 그룹 것이 섞여 있어도 된다)
	// @param _sort: 정렬기준
	// @param _clicks: Id별 클릭 수
	// @param _seen: Id별 최초 확인 시각(ms)
	public static OrderWithin<T extends IOrderEntry>(_group: IPluginGroup, _items: T[], _sort: TSidebarSort, _clicks: Record<string, number>, _seen: Record<string, number>): T[]
	{
		const member = new Set(_group.Items);
		const picked = _items.filter((_item) => member.has(_item.Id));
		return PluginOrder.SortExternal(picked, _group.Items, _clicks, _seen, _sort);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 한 영역의 그룹 배열을 읽어 굳힌다. 깨진 항목은 버리고 고정 그룹 2개는 반드시 채운다.
	// @param _raw: 저장된 값
	// @param _area: 영역
	private static ReadArea(_raw: unknown, _area: TPluginGroupArea): IPluginGroup[]
	{
		const root = PluginGroups.AsRecord(_raw);
		const list: unknown = root === null ? null : root[_area];
		const out: IPluginGroup[] = [];
		const index = new Map<string, IPluginGroup>();
		if (Array.isArray(list))
		{
			for (const entry of list as unknown[])
			{
				const group = PluginGroups.ReadGroup(entry);
				if (group === null)
					continue;
				const exist = index.get(group.Id);
				if (exist !== undefined)
				{
					exist.Items.push(...group.Items);
					continue;
				}
				index.set(group.Id, group);
				out.push(group);
			}
		}
		if (!out.some((_group) => _group.Id === PluginGroups.DefaultGroupId))
			out.unshift(PluginGroups.MakeFixed(PluginGroups.DefaultGroupId));
		if (!out.some((_group) => _group.Id === PluginGroups.HiddenGroupId))
			out.push(PluginGroups.MakeFixed(PluginGroups.HiddenGroupId));
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 1개를 읽어 굳힌다. Id가 없으면 null. 고정 Id면 종류·이름을 강제한다.
	// @param _entry: 저장된 그룹
	private static ReadGroup(_entry: unknown): IPluginGroup | null
	{
		const raw = PluginGroups.AsRecord(_entry);
		if (raw === null)
			return null;
		const rawId: unknown = raw["Id"];
		const id = typeof rawId === "string" ? rawId.trim() : "";
		if (id === "")
			return null;
		const fixed = PluginGroups.IsFixedGroup(id);
		const rawName: unknown = raw["Name"];
		const name = typeof rawName === "string" ? rawName.trim() : "";
		const rawCollapsed: unknown = raw["Collapsed"];
		const rawItems: unknown = raw["Items"];
		const items: string[] = [];
		if (Array.isArray(rawItems))
		{
			for (const value of rawItems as unknown[])
			{
				if (typeof value === "string" && value !== "")
					items.push(value);
			}
		}
		return {
			Id: id,
			Name: fixed ? PluginGroups.FixedName(id) : (name === "" ? id : name),
			Kind: fixed ? "Fixed" : "User",
			Collapsed: typeof rawCollapsed === "boolean" ? rawCollapsed : PluginGroups.IsHiddenGroup(id),
			Items: items,
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 어느 영역 소유인지 본다. 두 목록 어디에도 없으면 null(사라진 Id로 보고 자리를 지킨다).
	// @param _id: Plugin Id
	// @param _systemSet: 시스템 Id 집합
	// @param _externalSet: 외부 Id 집합
	private static OwnerOf(_id: string, _systemSet: Set<string>, _externalSet: Set<string>): TPluginGroupArea | null
	{
		if (_systemSet.has(_id))
			return "System";
		if (_externalSet.has(_id))
			return "External";
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 어느 그룹에도 없는 신규 Id를 기본 그룹 알파벳 위치에 끼워 넣는다. PluginOrder와 같은 방식.
	// @param _groups: 한 영역의 그룹들
	// @param _ids: 그 영역이 소유한 현재 Id
	private static InsertFresh(_groups: IPluginGroup[], _ids: string[]): void
	{
		const home = _groups.find((_group) => _group.Id === PluginGroups.DefaultGroupId);
		if (home === undefined)
			return;
		const have = new Set<string>();
		for (const group of _groups)
		{
			for (const id of group.Items)
				have.add(id);
		}
		const fresh = _ids.filter((_id) => !have.has(_id)).sort((_a, _b) => PluginOrder.CompareAlpha(_a, _b));
		for (const id of fresh)
		{
			let placed = false;
			for (let idx = 0; idx < home.Items.length; ++idx)
			{
				if (PluginOrder.CompareAlpha(id, home.Items[idx] as string) < 0)
				{
					home.Items.splice(idx, 0, id);
					placed = true;
					break;
				}
			}
			if (!placed)
				home.Items.push(id);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고정 그룹 1개를 만든다. 숨겨짐은 접힌 채로 시작한다.
	// @param _id: 고정 그룹 Id
	private static MakeFixed(_id: string): IPluginGroup
	{
		return { Id: _id, Name: PluginGroups.FixedName(_id), Kind: "Fixed", Collapsed: PluginGroups.IsHiddenGroup(_id), Items: [] };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고정 그룹 2개를 만든다.
	private static FixedPair(): IPluginGroup[]
	{
		return [PluginGroups.MakeFixed(PluginGroups.DefaultGroupId), PluginGroups.MakeFixed(PluginGroups.HiddenGroupId)];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고정 그룹 표시 이름.
	// @param _id: 고정 그룹 Id
	private static FixedName(_id: string): string
	{
		return _id === PluginGroups.HiddenGroupId ? PluginGroups.HiddenGroupName : PluginGroups.DefaultGroupName;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 영역 안에서 겹치지 않는 새 그룹 Id를 만든다.
	// @param _groups: 한 영역의 그룹들
	private static NewGroupId(_groups: IPluginGroup[]): string
	{
		const used = new Set(_groups.map((_group) => _group.Id));
		for (let idx = 1; idx <= _groups.length + 1; ++idx)
		{
			const id = `${PluginGroups.NewGroupPrefix}${idx}`;
			if (!used.has(id))
				return id;
		}
		return `${PluginGroups.NewGroupPrefix}${_groups.length + 2}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 한 영역의 그룹들을 복사한다. 입력을 건드리지 않기 위해 항목 배열까지 새로 만든다.
	// @param _state: 그룹 상태
	// @param _area: 영역
	private static CloneArea(_state: IPluginGroupState, _area: TPluginGroupArea): IPluginGroup[]
	{
		return _state[_area].map((_group) => ({ ..._group, Items: [..._group.Items] }));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 한 영역만 갈아 끼운 새 상태를 만든다. 반대쪽 영역은 그대로 공유한다.
	// @param _state: 그룹 상태
	// @param _area: 영역
	// @param _groups: 새 그룹들
	private static WithArea(_state: IPluginGroupState, _area: TPluginGroupArea, _groups: IPluginGroup[]): IPluginGroupState
	{
		if (_area === "System")
			return { System: _groups, External: _state.External };
		return { System: _state.System, External: _groups };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 삽입 위치를 범위 안으로 가둔다. 숫자가 아니거나 범위를 넘으면 맨 뒤.
	// @param _index: 요청 위치
	// @param _length: 대상 길이
	private static ClampIndex(_index: number, _length: number): number
	{
		if (!Number.isFinite(_index))
			return _length;
		return Math.max(0, Math.min(Math.trunc(_index), _length));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 순수 객체면 레코드로 본다. 배열·null은 아니다.
	// @param _value: 검사할 값
	private static AsRecord(_value: unknown): Record<string, unknown> | null
	{
		if (typeof _value !== "object" || _value === null || Array.isArray(_value))
			return null;
		return _value as Record<string, unknown>;
	}
}
