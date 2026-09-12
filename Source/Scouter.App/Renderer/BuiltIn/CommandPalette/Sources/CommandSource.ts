/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CommandSource. 명령 + Plugin 전환 항목. 기본 모드.
*/

import { CommandRegistry } from "../../../Services/CommandRegistry";
import { Hotkeys } from "../../../Services/Hotkeys";
import { Fuzzy } from "../Fuzzy";
import { RecentStore } from "../RecentStore";
import type { IItemSource, IPaletteItem } from "./ItemSource";

export interface IPluginRef
{
	Id: string;
	Name: string;
}

const kMaxItems = 50;

export class CommandSource implements IItemSource
{
	// ==================== 멤버 ====================
	public readonly Prefix = "";
	private readonly plugins_: () => IPluginRef[];
	private readonly recent_: RecentStore;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin 목록 제공자와 최근 저장소로 만든다.
	// @param _plugins: 활성 Plugin 목록 제공자
	// @param _recent: 최근 저장소
	public constructor(_plugins: () => IPluginRef[], _recent: RecentStore)
	{
		this.plugins_ = _plugins;
		this.recent_ = _recent;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// fuzzy 상위 50개를 점수·최근·한글 순으로 돌려준다.
	// @param _text: 접두어 제거 쿼리
	public Query(_text: string): IPaletteItem[]
	{
		const query = _text.toLowerCase();
		const out: IPaletteItem[] = [];
		for (const def of CommandRegistry.List())
		{
			const score = Fuzzy.Score(query, `${def.Title} ${def.Id}`);
			if (score === null)
				continue;
			out.push({
				Kind: "Command",
				Title: def.Title,
				Subtitle: def.Id,
				Hotkey: Hotkeys.HotkeyOf(def.Id) ?? def.Hotkey ?? "",
				Score: score,
				Run: () => { void CommandRegistry.Execute(def.Id); },
			});
		}
		for (const plugin of this.plugins_())
		{
			const title = `Plugin: ${plugin.Name}`;
			const score = Fuzzy.Score(query, title);
			if (score === null)
				continue;
			out.push({
				Kind: "Plugin",
				Title: title,
				Subtitle: plugin.Id,
				Hotkey: "",
				Score: score,
				Run: () => { void CommandRegistry.Execute("Shell.ShowPlugin", { Id: plugin.Id }); },
			});
		}
		const recent = this.recent_;
		const collator = new Intl.Collator("ko");
		out.sort((_a, _b) => (_b.Score - _a.Score) || (recent.Weight(_b.Title) - recent.Weight(_a.Title)) || collator.compare(_a.Title, _b.Title));
		return out.slice(0, kMaxItems);
	}
}
