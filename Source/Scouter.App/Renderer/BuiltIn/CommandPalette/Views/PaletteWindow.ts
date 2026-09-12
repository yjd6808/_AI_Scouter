/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PaletteWindow. Popup 레이어 팔레트. 검색·실행·인라인 편집.
*/

import { Window, RegisterWindow, TextBox, TextBlock, ListBox, StackPanel, EditorFactory, Visibility, Orientation, UIElement } from "@scouter/gui";
import type { DataList, IJsonSchemaNode, IPropertyEditor, KeyEventArgs } from "@scouter/gui";
import { Settings } from "../../../Services/Settings";
import { ThemeManager } from "../../../Theme/ThemeManager";
import { SettingsCatalog } from "../../ScouterCore/SettingsCatalog";
import { Fuzzy } from "../Fuzzy";
import { RecentStore } from "../RecentStore";
import type { IRecentStorage } from "../RecentStore";
import type { IItemSource, IPaletteItem, ISettingsPaletteItem, IThemePaletteItem } from "../Sources/ItemSource";
import { CommandSource } from "../Sources/CommandSource";
import { SettingsSource } from "../Sources/SettingsSource";
import type { IPluginRef } from "../Sources/CommandSource";
import { ThemeSource } from "../Sources/ThemeSource";

export interface IPaletteDeps
{
	Plugins(): IPluginRef[];
	Storage: IRecentStorage;
}

function IsPaletteItem(_value: unknown): _value is IPaletteItem
{
	if (typeof _value !== "object" || _value === null)
		return false;
	const record = _value as Record<string, unknown>;
	return typeof record["Title"] === "string" && typeof record["Run"] === "function";
}

@RegisterWindow("CommandPalette/Palette")
export class PaletteWindow extends Window
{
	// ==================== 정적 ====================
	private static s_sources_: IItemSource[] | null = null;
	private static s_recent_: RecentStore | null = null;

	// ==================== 멤버 ====================
	private mode_: IItemSource | null = null;
	private items_: IPaletteItem[] = [];
	private query_: string = "";
	private themeActive_ = false;
	private themeConfirmed_ = false;
	private themeOriginal_ = "oc-2";
	private editing_: ISettingsPaletteItem | null = null;
	private editor_: IPropertyEditor | null = null;
	private outside_: ((_e: PointerEvent) => void) | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 소스를 꽂는다. Plugin Activate에서 1회.
	// @param _deps: Plugin 목록·저장소
	public static Configure(_deps: IPaletteDeps): void
	{
		const recent = new RecentStore(_deps.Storage);
		PaletteWindow.s_recent_ = recent;
		PaletteWindow.s_sources_ = [new CommandSource(() => _deps.Plugins(), recent), new SettingsSource(), new ThemeSource()];
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨트롤을 잡고 검색을 건다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		const query = this.RequireName(TextBox, "txt_query");
		const list = this.RequireName(ListBox, "lst_items");
		list.ItemTemplate = (_item) => RowOf(_item, this.query_);
		query.TextChanged.Add(() => { this.Refresh(); });
		query.PreviewKeyDown.Add((_s, _a) => { this.OnQueryKey(_a); });
		list.SelectionChanged.Add(() => { this.OnSelectionChanged(); });
		this.Refresh();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 검색창에 포커스하고 바깥 클릭 닫기를 건다.
	protected override OnShown(): void
	{
		this.RequireName(TextBox, "txt_query").Focus();
		this.outside_ = (_e) =>
		{
			if (!this.Element.contains(_e.target as Node))
				this.ClosePalette();
		};
		document.addEventListener("pointerdown", this.outside_, { capture: true });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 바깥 클릭 감시를 풀고 테마 미리보기를 원복한다.
	protected override OnClosed(): void
	{
		if (this.outside_ !== null)
		{
			document.removeEventListener("pointerdown", this.outside_, { capture: true });
			this.outside_ = null;
		}
		this.RevertTheme();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 접두어로 모드를 고르고 목록을 갱신한다.
	private Refresh(): void
	{
		const sources = PaletteWindow.s_sources_;
		if (sources === null)
			return;
		const query = this.RequireName(TextBox, "txt_query").Text;
		const lowered = query.toLowerCase();
		let found: IItemSource = sources[0] as IItemSource;
		for (const source of sources)
		{
			if (source.Prefix.length > 0 && lowered.startsWith(source.Prefix))
				found = source;
		}
		const text = found.Prefix.length > 0 ? query.slice(found.Prefix.length) : query;
		this.EnterMode(found, text);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 모드 전환(테마 원복 포함)과 목록 갱신.
	// @param _source: 활성 소스
	// @param _text: 접두어 제거 쿼리
	private EnterMode(_source: IItemSource, _text: string): void
	{
		if (this.mode_ !== null && this.mode_.Prefix === "theme " && _source.Prefix !== "theme ")
			this.RevertTheme();
		if (_source.Prefix === "theme " && !this.themeActive_)
		{
			this.themeActive_ = true;
			this.themeConfirmed_ = false;
			this.themeOriginal_ = Settings.Get<string>("Theme.Id", "oc-2");
		}
		this.mode_ = _source;
		this.query_ = _text.toLowerCase();
		this.items_ = _source.Query(_text);
		const list = this.RequireName(ListBox, "lst_items");
		list.SetItems(this.items_);
		list.SelectedIndex = this.items_.length > 0 ? 0 : -1;
		this.Hint(this.HintOf(_source.Prefix));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 모드별 힌트 문구.
	// @param _prefix: 활성 접두어
	private HintOf(_prefix: string): string
	{
		if (_prefix === "set ")
			return "↵ 편집  ↑↓ 이동  esc 닫기";
		if (_prefix === "theme ")
			return "↵ 적용  ↑↓ 미리보기  esc 원복";
		return "↑↓ 이동  ↵ 실행  esc 닫기      set / theme 접두어";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 검색창 키 처리. Up/Down 순환, Enter 실행, ESC 닫기.
	// @param _args: 키 인자
	private OnQueryKey(_args: KeyEventArgs): void
	{
		if (_args.Key === "Escape")
		{
			_args.Handled = true;
			this.ClosePalette();
			return;
		}
		const list = this.RequireName(ListBox, "lst_items");
		if (_args.Key === "ArrowDown" || _args.Key === "ArrowUp")
		{
			_args.Handled = true;
			if (this.items_.length === 0)
				return;
			const dir = _args.Key === "ArrowDown" ? 1 : -1;
			const next = ((list.SelectedIndex < 0 ? 0 : list.SelectedIndex) + dir + this.items_.length) % this.items_.length;
			list.SelectedIndex = next;
			return;
		}
		if (_args.Key === "Enter")
		{
			_args.Handled = true;
			void this.ExecuteSelectedAsync();
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마 모드 하이라이트 미리보기.
	private OnSelectionChanged(): void
	{
		if (!this.themeActive_ || this.themeConfirmed_)
			return;
		const selected = this.RequireName(ListBox, "lst_items").SelectedItem;
		if (this.IsThemeItem(selected))
			ThemeManager.Preview(selected.ThemeId);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 항목을 실행한다. 설정은 인라인 편집으로 이어간다.
	private async ExecuteSelectedAsync(): Promise<void>
	{
		const selected = this.RequireName(ListBox, "lst_items").SelectedItem;
		if (!IsPaletteItem(selected))
			return;
		if (selected.Kind === "Settings")
		{
			this.BeginEdit(selected as ISettingsPaletteItem);
			return;
		}
		if (selected.Kind === "Theme")
		{
			this.ConfirmTheme(selected as IThemePaletteItem);
			return;
		}
		try
		{
			await selected.Run();
			PaletteWindow.s_recent_?.Bump(selected.Title);
			this.ClosePalette();
		}
		catch (_e)
		{
			this.Hint(String(_e instanceof Error ? _e.message : _e));
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마를 확정한다. Settings 기록 + 닫기.
	// @param _item: 테마 항목
	private ConfirmTheme(_item: IThemePaletteItem): void
	{
		ThemeManager.Preview(_item.ThemeId);
		Settings.Set("Theme.Id", _item.ThemeId);
		this.themeConfirmed_ = true;
		this.themeActive_ = false;
		PaletteWindow.s_recent_?.Bump(_item.Title);
		this.ClosePalette();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 미확정 미리보기를 원복한다.
	private RevertTheme(): void
	{
		if (!this.themeActive_ || this.themeConfirmed_)
			return;
		this.themeActive_ = false;
		ThemeManager.Preview(this.themeOriginal_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 인라인 에디터를 연다.
	// @param _item: 설정 항목
	private BeginEdit(_item: ISettingsPaletteItem): void
	{
		const node = PaletteWindow.SchemaOf(_item.Key);
		if (node === null)
		{
			this.Hint(`스키마 없음: ${_item.Key}`);
			return;
		}
		this.EndEdit();
		this.editing_ = _item;
		const editor = EditorFactory.Create(node);
		this.editor_ = editor;
		editor.Set(Settings.Has(_item.Key) ? Settings.Get<unknown>(_item.Key) : node.default);
		const list = this.RequireName(ListBox, "lst_items");
		list.Visibility = Visibility.Collapsed;
		const root = this.RequireName(StackPanel, "root");
		root.AddChild(editor.Element, 1);
		editor.Changed.Add(() => { this.CommitEdit(); });
		editor.Element.PreviewKeyDown.Add((_s, _a) => { this.OnEditorKey(_a); });
		editor.Element.Focus();
		this.Hint("↵ 저장  esc 취소");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에디터 키 처리. ESC면 편집 취소.
	// @param _args: 키 인자
	private OnEditorKey(_args: KeyEventArgs): void
	{
		if (_args.Key !== "Escape")
			return;
		_args.Handled = true;
		this.EndEdit();
		this.Refresh();
		this.RequireName(TextBox, "txt_query").Focus();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에디터 값을 설정에 쓴다. 검증 실패면 힌트에 표시하고 유지.
	private CommitEdit(): void
	{
		const item = this.editing_;
		const editor = this.editor_;
		if (item === null || editor === null)
			return;
		try
		{
			Settings.Set(item.Key, editor.Get());
		}
		catch (_e)
		{
			this.Hint(String(_e instanceof Error ? _e.message : _e));
			return;
		}
		PaletteWindow.s_recent_?.Bump(item.Title);
		this.EndEdit();
		this.ClosePalette();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에디터를 치운다.
	private EndEdit(): void
	{
		if (this.editor_ !== null)
		{
			const root = this.FindName(StackPanel, "root");
			if (root !== null)
				root.RemoveChild(this.editor_.Element);
			this.editor_ = null;
		}
		this.editing_ = null;
		this.RequireName(ListBox, "lst_items").Visibility = Visibility.Visible;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 닫는다. 테마 원복은 OnClosed가 맡는다.
	private ClosePalette(): void
	{
		this.Close(undefined);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 힌트 문구를 바꾼다.
	// @param _text: 문구
	private Hint(_text: string): void
	{
		this.RequireName(TextBlock, "txt_hint").Text = _text;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 테마 항목인지 본다.
	// @param _value: 선택값
	private IsThemeItem(_value: unknown): _value is IThemePaletteItem
	{
		return IsPaletteItem(_value) && _value.Kind === "Theme";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 키의 스키마 노드를 찾는다. 없으면 null.
	// @param _key: 점 표기 키
	private static SchemaOf(_key: string): IJsonSchemaNode | null
	{
		for (const category of SettingsCatalog.Categories())
		{
			const found = PaletteWindow.FindNode(category.Id, category.Schema, _key);
			if (found !== null)
				return found;
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 카테고리 스키마에서 키를 찾는다.
	// @param _group: 그룹 Id
	// @param _node: 스키마 노드
	// @param _key: 점 표기 키
	private static FindNode(_group: string, _node: IJsonSchemaNode, _key: string): IJsonSchemaNode | null
	{
		const props = _node.properties ?? {};
		for (const [name, child] of Object.entries(props))
		{
			const path = `${_group}.${name}`;
			if (path === _key)
				return child;
			if (child.properties !== undefined)
			{
				const nested = PaletteWindow.FindNode(path, child, _key);
				if (nested !== null)
					return nested;
			}
		}
		return null;
	}
}

//////////////////////////////////////////////////////////////////////////////////////
// 목록 행을 만든다. 일치 구간은 굵게.
// @param _item: 항목
// @param _query: 소문자 쿼리
function RowOf(_item: unknown, _query: string): UIElement
{
	const row = new StackPanel();
	row.Orientation = Orientation.Horizontal;
	if (!IsPaletteItem(_item))
	{
		const fallback = new TextBlock();
		fallback.Text = String(_item);
		row.AddChild(fallback);
		return row;
	}
	for (const run of Fuzzy.Highlight(_query, _item.Title) ?? [{ Text: _item.Title, Match: false }])
	{
		const cell = new TextBlock();
		cell.Text = run.Text;
		if (run.Match)
			cell.Element.style.fontWeight = "600";
		row.AddChild(cell);
	}
	if (_item.Hotkey.length > 0)
	{
		const gap = new TextBlock();
		gap.Text = `   ${_item.Hotkey}`;
		row.AddChild(gap);
	}
	return row;
}
