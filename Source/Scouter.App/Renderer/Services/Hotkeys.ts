/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Hotkeys. root PreviewKeyDown을 명령에 연결한다.
*/

import { UIElement } from "@scouter/gui";
import type { IDisposable } from "@scouter/gui";
import { CommandRegistry } from "./CommandRegistry";

export class Hotkeys
{
	// ==================== 정적 ====================
	private static readonly s_map_ = new Map<string, string>();
	private static s_attached_ = false;
	private static s_root_: UIElement | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 루트에 붙는다. PreviewKeyDown 선두에서 가로챈다.
	// @param _root: 루트 요소
	public static Attach(_root: UIElement): void
	{
		Hotkeys.s_root_ = _root;
		if (Hotkeys.s_attached_)
			return;
		Hotkeys.s_attached_ = true;
		_root.PreviewKeyDown.Add((_s, _a) =>
		{
			const chord = Hotkeys.FromEvent(_a.Key, _a.Code, _a.Ctrl, _a.Shift, _a.Alt, _a.Meta);
			const id = Hotkeys.s_map_.get(chord);
			if (id === undefined)
				return;
			if (!CommandRegistry.CanExecute(id))
				return;
			void CommandRegistry.Execute(id);
			_a.Handled = true;
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 조합을 명령에 묶는다.
	// @param _chord: "Ctrl+Shift+P"
	// @param _commandId: 명령 Id
	public static Bind(_chord: string, _commandId: string): IDisposable
	{
		const key = Hotkeys.Normalize(_chord);
		Hotkeys.s_map_.set(key, _commandId);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				if (Hotkeys.s_map_.get(key) === _commandId)
					Hotkeys.s_map_.delete(key);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 명령의 핫키를 역조회한다. 없으면 null. 팔레트 Badge용.
	// @param _commandId: 명령 Id
	public static HotkeyOf(_commandId: string): string | null
	{
		for (const [chord, id] of Hotkeys.s_map_)
		{
			if (id === _commandId)
				return chord;
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// "shift+ctrl+p" → "Ctrl+Shift+P". 순서는 Ctrl Shift Alt Meta.
	// @param _chord: 원문
	public static Normalize(_chord: string): string
	{
		const parts = _chord.split("+").map((_p) => _p.trim().toLowerCase()).filter((_p) => _p.length > 0);
		const key = parts[parts.length - 1] as string;
		const has = new Set(parts.slice(0, -1));
		const out: string[] = [];
		if (has.has("ctrl"))
			out.push("Ctrl");
		if (has.has("shift"))
			out.push("Shift");
		if (has.has("alt"))
			out.push("Alt");
		if (has.has("meta") || has.has("win") || has.has("cmd"))
			out.push("Meta");
		const pretty = key.length === 1 ? key.toUpperCase() : key;
		out.push(pretty);
		return out.join("+");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 이벤트에서 조합 문자열을 만든다.
	// @param _key: 키
	// @param _code: 코드
	// @param _ctrl: Ctrl
	// @param _shift: Shift
	// @param _alt: Alt
	// @param _meta: Meta
	private static FromEvent(_key: string, _code: string, _ctrl: boolean, _shift: boolean, _alt: boolean, _meta: boolean): string
	{
		const parts: string[] = [];
		if (_ctrl)
			parts.push("ctrl");
		if (_shift)
			parts.push("shift");
		if (_alt)
			parts.push("alt");
		if (_meta)
			parts.push("meta");
		parts.push(_key.length === 1 ? _key : _code);
		return Hotkeys.Normalize(parts.join("+"));
	}
}
