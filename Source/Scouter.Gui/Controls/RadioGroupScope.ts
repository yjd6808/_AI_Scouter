/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: RadioGroupScope. 그룹 배타 선택 저장소.
*/

import type { RadioButton } from "./RadioButton";

export class RadioGroupScope
{
	// ==================== 정적 ====================
	private static readonly s_groups_ = new Map<string, Set<RadioButton>>();

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 키를 구한다. GroupName 없으면 부모 기준.
	// @param _button: 버튼
	public static KeyOf(_button: RadioButton): string
	{
		if (_button.GroupName.length > 0)
			return `named:${_button.GroupName}`;
		const parent = _button.Parent;
		return `parent:${parent?.Name ?? "root"}:${parent?.Children.indexOf(_button) ?? 0}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록한다. Loaded 시점.
	// @param _button: 버튼
	public static Register(_button: RadioButton): void
	{
		const key = RadioGroupScope.KeyOf(_button);
		let set = RadioGroupScope.s_groups_.get(key);
		if (set === undefined)
		{
			set = new Set();
			RadioGroupScope.s_groups_.set(key, set);
		}
		set.add(_button);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택을 하나로 모은다.
	// @param _button: 선택 버튼
	public static Select(_button: RadioButton): void
	{
		const set = RadioGroupScope.s_groups_.get(RadioGroupScope.KeyOf(_button));
		if (set === undefined)
			return;
		for (const other of set)
		{
			if (other !== _button && other.IsChecked)
				other.IsChecked = false;
		}
	}
}
