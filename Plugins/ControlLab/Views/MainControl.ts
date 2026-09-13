/*
	작성자: 윤정도
	생성일: 2026-09-13
	=====
	설명: ControlLab 메인 화면. 모든 컨트롤을 눌러보고 이벤트로 기록한다.
*/

import { UserControl, Button, RepeatButton, ToggleButton, CheckBox, RadioButton } from "@scouter/gui";
import { TextBox, PasswordBox, Slider, NumericUpDown, ProgressBar, ComboBox } from "@scouter/gui";
import { ListBox, ListView, TreeView, MenuItem, ContextMenu, ToolBar, DataGrid } from "@scouter/gui";
import { Badge, Avatar, StatusDot, DotStatus, Spinner, LogView, VirtualList } from "@scouter/gui";
import { CodeEditor, DiffView, MarkdownView, PropertyGrid, TextBlock } from "@scouter/gui";
import type { DataList } from "@scouter/gui";
import type { ControlStore } from "../ControlStore";
import type { TControlEventKind } from "../Types";

export class MainControl extends UserControl
{
	// ==================== 정적 ====================
	private static s_store_: ControlStore | null = null;

	// ==================== 멤버 ====================
	private data_!: DataList;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소를 둔다. Index OnActivate에서 1회.
	// @param _store: 이벤트 저장소
	public static Configure(_store: ControlStore): void
	{
		MainControl.s_store_ = _store;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨트롤을 묶고 데모 데이터를 깐다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.data_ = _data;
		this.BindButtons();
		this.BindInputs();
		this.BindLists();
		this.BindScouter();
		this.RefreshCounts("info", "init");
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 버튼 탭을 묶는다.
	private BindButtons(): void
	{
		const names: ReadonlyArray<string> = ["btn_primary", "btn_ghost", "btn_danger", "btn_icon", "btn_tool_a", "btn_tool_b", "btn_wrap_a", "btn_wrap_b", "btn_wrap_c"];
		for (const name of names)
		{
			this.FindName(Button, name)?.Click.Add(() =>
			{
				this.RefreshCounts("info", name);
			});
		}
		this.FindName(RepeatButton, "btn_repeat")?.Click.Add(() =>
		{
			this.RefreshCounts("info", "btn_repeat");
		});
		this.FindName(ToggleButton, "tgl_demo")?.Click.Add(() =>
		{
			const checked = this.FindName(ToggleButton, "tgl_demo")?.IsChecked === true;
			this.RefreshCounts("info", `tgl_demo:${checked ? "on" : "off"}`);
		});
		this.FindName(CheckBox, "chk_demo")?.Click.Add(() =>
		{
			const checked = this.FindName(CheckBox, "chk_demo")?.IsChecked === true;
			this.RefreshCounts("info", `chk_demo:${checked ? "on" : "off"}`);
		});
		this.FindName(CheckBox, "chk_group")?.Click.Add(() =>
		{
			this.RefreshCounts("info", "chk_group");
		});
		this.FindName(RadioButton, "radio_a")?.Click.Add(() =>
		{
			this.RefreshCounts("info", "radio_a");
		});
		this.FindName(RadioButton, "radio_b")?.Click.Add(() =>
		{
			this.RefreshCounts("info", "radio_b");
		});
		this.FindName(Button, "btn_clear")?.Click.Add(() =>
		{
			MainControl.s_store_?.Clear();
			this.RefreshCounts("warn", "clear", true);
		});
		this.FindName(Button, "btn_sample")?.Click.Add(() =>
		{
			this.PushSample();
		});
		const primary = this.FindName(Button, "btn_primary");
		if (primary !== null)
			primary.ToolTip = "기본 버튼";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 입력 탭을 묶는다.
	private BindInputs(): void
	{
		this.FindName(TextBox, "txt_input")?.TextCommitted.Add(() =>
		{
			this.RefreshCounts("info", "txt_input");
		});
		this.FindName(PasswordBox, "pwd_input")?.PasswordChanged.Add(() =>
		{
			this.RefreshCounts("info", "pwd_input");
		});
		this.FindName(NumericUpDown, "num_demo")?.ValueChanged.Add((_s, _a) =>
		{
			this.RefreshCounts("info", `num_demo:${_a.NewValue}`);
		});
		this.FindName(Slider, "slider_demo")?.ValueChanged.Add((_s, _a) =>
		{
			const bar = this.FindName(ProgressBar, "bar_demo");
			if (bar !== null)
				bar.Value = _a.NewValue;
			this.RefreshCounts("info", `slider_demo:${_a.NewValue}`);
		});
		const combo = this.FindName(ComboBox, "cmb_demo");
		combo?.SetItems(["사과", "배", "포도"]);
		combo?.SelectionChanged.Add(() =>
		{
			this.RefreshCounts("info", "cmb_demo");
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록 탭을 묶는다.
	private BindLists(): void
	{
		const list = this.FindName(ListBox, "lst_demo");
		list?.SetItems(["첫째", "둘째", "셋째", "넷째"]);
		list?.SelectionChanged.Add(() =>
		{
			this.RefreshCounts("info", "lst_demo");
		});
		if (list !== null)
		{
			const menu = new ContextMenu();
			const item = new MenuItem();
			item.Header = "새로고침";
			item.Click.Add(() =>
			{
				this.RefreshCounts("info", "ctx_refresh");
			});
			menu.AddItem(item);
			list.ContextMenu = menu;
		}
		const view = this.FindName(ListView, "lst_view");
		view?.SetItems([{ Name: "a", Value: 1 }, { Name: "b", Value: 2 }]);
		view?.SelectionChanged.Add(() =>
		{
			this.RefreshCounts("info", "lst_view");
		});
		const tree = this.FindName(TreeView, "tree_demo");
		tree?.SetItems([{ Name: "루트", Kids: [{ Name: "자식", Kids: [] }] }], {
			HeaderOf: (_n) => (_n as { Name: string }).Name,
			ChildrenOf: (_n) => (_n as { Kids: unknown[] }).Kids,
			HasChildren: (_n) => (_n as { Kids: unknown[] }).Kids.length > 0,
		});
		tree?.SelectedItemChanged.Add(() =>
		{
			this.RefreshCounts("info", "tree_demo");
		});
		this.FindName(MenuItem, "menu_file")?.Click.Add(() =>
		{
			this.RefreshCounts("info", "menu_file");
		});
		this.FindName(MenuItem, "menu_edit")?.Click.Add(() =>
		{
			this.RefreshCounts("info", "menu_edit");
		});
		const toolbar = this.FindName(ToolBar, "bar_tools");
		if (toolbar !== null)
			toolbar.UpdateOverflow();
		const grid = this.FindName(DataGrid, "grid_demo");
		grid?.SetItems([{ Name: "a", Value: 1 }, { Name: "b", Value: 2 }]);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Scouter 탭을 묶는다.
	private BindScouter(): void
	{
		const badge = this.FindName(Badge, "badge_demo");
		if (badge !== null)
			badge.Text = "7";
		const avatar = this.FindName(Avatar, "avatar_demo");
		if (avatar !== null)
			avatar.Text = "홍 길동";
		const dot = this.FindName(StatusDot, "dot_demo");
		if (dot !== null)
			dot.Status = DotStatus.Busy;
		const spinner = this.FindName(Spinner, "spin_demo");
		if (spinner !== null)
			spinner.Size = 20;
		const log = this.FindName(LogView, "log_demo");
		log?.Append({ Ts: Date.now(), Level: "info", Scope: "lab", Msg: "로그 시작" });
		const virtual = this.FindName(VirtualList, "virtual_demo");
		if (virtual !== null)
		{
			virtual.ItemTemplate = (_idx) =>
			{
				const row = new TextBlock();
				row.Text = `행 ${_idx}`;
				return row;
			};
			virtual.Count = 200;
		}
		const code = this.FindName(CodeEditor, "code_demo");
		if (code !== null)
		{
			code.Language = "typescript";
			code.Text = "const lab = 1;";
		}
		const diff = this.FindName(DiffView, "diff_demo");
		if (diff !== null)
		{
			diff.Language = "typescript";
			diff.Original = "const a = 1;";
			diff.Modified = "const a = 2;";
		}
		const md = this.FindName(MarkdownView, "md_demo");
		if (md !== null)
			md.Source = "# 랩\n\n- 하나\n- 둘";
		const props = this.FindName(PropertyGrid, "grid_props");
		if (props !== null)
		{
			try
			{
				props.SetSchema(
					{ type: "object", properties: { nick: { type: "string", description: "별명" }, level: { type: "number", description: "레벨" } } },
					{ nick: "테스터", level: 3 },
				);
			}
			catch
			{
				this.RefreshCounts("warn", "grid_props:skip");
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 샘플 로그를 쌓는다.
	private PushSample(): void
	{
		const log = this.FindName(LogView, "log_demo");
		log?.Append({ Ts: Date.now(), Level: "info", Scope: "lab", Msg: "샘플" });
		log?.Append({ Ts: Date.now(), Level: "warn", Scope: "lab", Msg: "주의" });
		this.RefreshCounts("success", "btn_sample");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장소에 쌓고 카운터를 바인딩에 반영한다.
	// @param _kind: 종류
	// @param _name: 컨트롤 이름
	// @param _skipLog: 저장 생략 여부
	private RefreshCounts(_kind: TControlEventKind, _name: string, _skipLog = false): void
	{
		const store = MainControl.s_store_;
		if (store !== null && !_skipLog)
			store.Log(_kind, _name, "");
		const count = store === null ? 0 : store.Count();
		this.data_.Set("eventCount", count);
		this.data_.Set("lastEvent", _name);
		const dot = this.FindName(StatusDot, "dot_state");
		if (dot !== null)
			dot.Status = count % 2 === 0 ? DotStatus.Idle : DotStatus.Ok;
	}
}
