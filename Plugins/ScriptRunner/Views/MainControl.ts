/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScriptRunner 메인 화면. 엔진의 구독자일 뿐이라 이 화면이 없어도 예약은 혼자 돈다.
	      아래쪽은 실행 로그 상자(읽기 전용 textarea)다. 줄을 덧붙일 때 선택 영역이 풀리지 않게 setRangeText로 붙인다.
	      목록 행은 코드로 만든다. 한 행 = [상태 점][제목][프리셋 ▾·저장][인자 입력란…][즉시 실행/중지][남은 시간]이고,
	      인자 칸이 남는 폭(*)을 차지해 버튼과 남은 시간이 오른쪽에 붙는다. 행은 엔진 Revision이 바뀔 때만
	      다시 만들고, 그 밖에는 버튼·점·남은 시간만 고친다 — 입력란에 글자를 치는 중에 행이 다시 만들어지면
	      포커스와 입력이 날아가기 때문이다. 오버레이 2종(등록·출력)은 루트 Grid의 같은 칸에 겹쳐 둔다.
*/

import { UserControl, Button, TextBox, CheckBox, RadioButton, NumericUpDown, TextBlock, StackPanel, WrapPanel, Grid, ComboBox } from "@scouter/gui";
import { StatusDot, DotStatus, Orientation, ContextMenu, MenuItem } from "@scouter/gui";
import type { DataList, UIElement } from "@scouter/gui";
import { RunLog } from "../RunLog";
import { RunnerEngine } from "../RunnerEngine";
import { ScheduleCalc } from "../ScheduleCalc";
import { ScriptFormat } from "../ScriptFormat";
import type { IEntrySpec, IRunLogLine, IRunnerViewPorts, IScriptArg, IScriptEntry, IScriptSchedule, TEntryState } from "../Types";

// 행 열 정의. XML 컬럼명 행(grid_list_head)과 같은 문자열이어야 컬럼 x가 맞는다.
const kRowColumns = "12,200,176,*,104,130";
const kArgBoxWidth = 150;
const kPresetComboWidth = 116;
const kNoPresetLabel = "없음";
// 화면 로그 상자에는 최근 이만큼만 둔다. 전체 기록은 RunLog(파일)에 있다.
const kViewLogLines = 2000;
const kLogScopeLabels: ReadonlyArray<string> = ["전체 스크립트", "선택한 스크립트"];
const kOutputChars = 200000;
const kDayMs = 86400000;
const kStyleId = "scriptrunner-view-style";
const kViewClass = "scriptrunner-view";
const kRowClass = "scriptrunner-row";
const kTitleClass = "scriptrunner-title";
const kArgsClass = "scriptrunner-args";
const kRemainClass = "scriptrunner-remain";
const kPresetClass = "scriptrunner-preset";
const kSelectedClass = "is-selected";
// 색은 전부 테마 CSS 변수를 쓴다. 행은 코드로 만들어 XML 스타일을 못 받으므로 여기로 모은다.
// 콤보박스는 Gui 기본이 버튼 모양(화살표 없음)이라 버튼과 구분되지 않는다. 이 화면에서만 입력란 배경·왼쪽 정렬·▾를 준다.
const kViewCss = `
.${kViewClass} .gui-grid > [data-testid="pnl_add"], .${kViewClass} .gui-grid > [data-testid="pnl_output"], .${kViewClass} .gui-grid > [data-testid="pnl_preset"] { align-self: center; }
.${kViewClass} .gui-grid > [data-testid="ovl_add"], .${kViewClass} .gui-grid > [data-testid="ovl_output"], .${kViewClass} .gui-grid > [data-testid="ovl_preset"] { position: relative; z-index: 1; }
.${kViewClass} [data-testid="pnl_list"], .${kViewClass} [data-testid="pnl_log"] { min-height: 0; }
.${kViewClass} [data-testid="txt_log"] { display: flex; min-height: 0; height: 100%; }
.${kViewClass} [data-testid="txt_log"] textarea { flex: 1 1 auto; height: 100%; min-height: 0; resize: none; white-space: pre; overflow: auto; font-family: Consolas, 'D2Coding', monospace; font-size: 12px; line-height: 1.45; }
.${kViewClass} [data-testid="split_log"] { cursor: row-resize; border-top: 1px solid var(--border-weak-base); }
.${kViewClass} .${kPresetClass} { gap: 4px; align-items: center; min-width: 0; }
.${kViewClass} .gui-combobox__toggle { justify-content: flex-start; padding: 2px 8px; background: var(--input-background); color: var(--text-base); }
.${kViewClass} .gui-combobox__toggle:hover { background: var(--input-background); border-color: var(--primary); }
.${kViewClass} .gui-combobox__value { text-align: left; }
.${kViewClass} .gui-combobox__toggle::after { content: ""; flex: none; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid var(--text-weak); }
.${kViewClass} [data-testid="grid_list_head"] { column-gap: 8px; padding: 0 8px 4px 8px; border-bottom: 1px solid var(--border-weak-base); }
.${kViewClass} [data-testid="grid_list_head"] .gui-text { color: var(--text-weak); font-size: var(--gui-font-sm, 12px); }
.${kViewClass} .${kRowClass} { column-gap: 8px; align-items: center; padding: 4px 8px; min-height: 34px; border-radius: 4px; border-bottom: 1px solid var(--border-weak-base); }
.${kViewClass} .${kRowClass}:hover { background: var(--background-hover); }
.${kViewClass} .${kRowClass}.${kSelectedClass} { background: var(--primary-muted); }
.${kViewClass} .${kTitleClass} { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
.${kViewClass} .${kArgsClass} { gap: 6px; min-width: 0; }
.${kViewClass} .${kRemainClass} { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
`;

type TFormOutcome =
	| { Ok: true; Spec: IEntrySpec }
	| { Ok: false; Error: string };

interface IRowHandle
{
	Id: string;
	Root: Grid;
	Dot: StatusDot;
	Title: TextBlock;
	Run: Button;
	Remain: TextBlock;
	Boxes: TextBox[];
	Running: boolean | null;
}

interface IFormArg
{
	Root: Grid;
	Name: TextBox;
	Value: TextBox;
	Required: CheckBox;
}

//////////////////////////////////////////////////////////////////////////////////////
// 두 자리로 0을 채운다.
// @param _value: 숫자
function Pad2(_value: number): string
{
	return _value < 10 ? `0${_value}` : String(_value);
}

export class MainControl extends UserControl
{
	// ==================== 정적 ====================
	private static s_engine_: RunnerEngine | null = null;
	private static s_log_: RunLog | null = null;
	private static s_ports_: IRunnerViewPorts | null = null;

	// ==================== 멤버 ====================
	private data_!: DataList;
	private rowsPanel_: StackPanel | null = null;
	private readonly rows_ = new Map<string, IRowHandle>();
	private formArgs_: IFormArg[] = [];
	private seenRevision_ = -1;
	private selectedId_ = "";
	// 수정 중인 항목 Id. 비어 있으면 등록 오버레이는 "새 스크립트" 모드다.
	private editingId_ = "";
	private outputId_ = "";
	private outputKey_ = "";
	private outputBusy_ = false;
	private stopTick_: (() => void) | null = null;
	private stopChanged_: (() => void) | null = null;
	private stopLog_: (() => void) | null = null;
	// 프리셋 저장 오버레이가 다루는 항목 Id.
	private presetId_ = "";
	// 행을 다시 만들며 콤보박스 선택을 코드로 맞출 때는 불러오기를 하지 않는다.
	private suppressPreset_ = false;
	private logScopeAll_ = true;
	private logLineCount_ = 0;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진·실행 로그·화면 창구를 1회 주입한다. Index OnActivate에서만 부른다.
	// @param _engine: Index가 만든 엔진 인스턴스
	// @param _log: 실행 로그
	// @param _ports: 공용 틱·확인창·알림 창구
	public static Configure(_engine: RunnerEngine, _log: RunLog, _ports: IRunnerViewPorts): void
	{
		MainControl.s_engine_ = _engine;
		MainControl.s_log_ = _log;
		MainControl.s_ports_ = _ports;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨트롤을 묶고 목록을 채운 뒤 공용 틱과 엔진 변경 알림에 화면 갱신을 얹는다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.data_ = _data;
		this.Element.classList.add(kViewClass);
		MainControl.EnsureStyle();
		this.rowsPanel_ = this.FindName(StackPanel, "pnl_rows");
		this.BindTop();
		this.BindForm();
		this.BindOutput();
		this.BindPreset();
		this.BindLog();
		this.BindKeys();
		this.Refresh(Date.now());
		this.RebuildLog();
		const engine = MainControl.s_engine_;
		if (engine !== null)
			this.stopChanged_ = engine.OnChanged(() => { this.Refresh(Date.now()); });
		const log = MainControl.s_log_;
		if (log !== null)
		{
			this.stopLog_ = log.OnChanged((_added: IRunLogLine[], _reset: boolean) =>
			{
				if (_reset)
					this.RebuildLog();
				else
					this.AppendLog(_added);
			});
		}
		const ports = MainControl.s_ports_;
		if (ports !== null)
			this.stopTick_ = ports.Tick((_now: number) => { this.Refresh(_now); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 구독을 끊는다.
	protected override OnDispose(): void
	{
		this.stopTick_?.();
		this.stopTick_ = null;
		this.stopChanged_?.();
		this.stopChanged_ = null;
		this.stopLog_?.();
		this.stopLog_ = null;
		this.rows_.clear();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상단 버튼을 묶는다.
	private BindTop(): void
	{
		this.FindName(Button, "btn_add")?.Click.Add(() => { this.OpenAdd(null); });
		this.FindName(Button, "btn_stop_all")?.Click.Add(() => { void this.StopAllAsync(); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 오버레이를 묶는다. 스케줄링 체크가 반복 수행 체크와 예약 입력을 켜고 끈다.
	private BindForm(): void
	{
		const overlay = this.FindName(Grid, "ovl_add");
		overlay?.PointerDown.Add((_s, _a) =>
		{
			// 딤 자체를 눌렀을 때만 닫는다. 패널 안쪽 클릭은 Source가 달라 걸리지 않는다.
			if (_a.Source === overlay)
				this.CloseAdd();
		});
		this.FindName(Button, "btn_add_close")?.Click.Add(() => { this.CloseAdd(); });
		this.FindName(Button, "btn_add_cancel")?.Click.Add(() => { this.CloseAdd(); });
		this.FindName(Button, "btn_save")?.Click.Add(() => { this.SaveForm(); });
		this.FindName(Button, "btn_arg_add")?.Click.Add(() =>
		{
			const arg = this.AddFormArg({ Name: "", Required: true, Value: "" });
			requestAnimationFrame(() => { arg.Name.Focus(); });
		});
		const schedule = this.FindName(CheckBox, "chk_schedule");
		schedule?.Checked.Add(() => { this.SetData("isScheduled", true); });
		schedule?.Unchecked.Add(() =>
		{
			this.SetData("isScheduled", false);
			this.SetCheck("chk_repeat", false);
		});
		this.FindName(RadioButton, "radio_after")?.Checked.Add(() => { this.SetData("isAt", false); });
		this.FindName(RadioButton, "radio_at")?.Checked.Add(() => { this.SetData("isAt", true); });
		this.FindName(Button, "btn_date_today")?.Click.Add(() => { this.SetText("txt_at_date", ScriptFormat.DateInput(Date.now())); });
		this.FindName(Button, "btn_date_tomorrow")?.Click.Add(() => { this.SetText("txt_at_date", ScriptFormat.DateInput(Date.now() + kDayMs)); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 출력 오버레이를 묶는다.
	private BindOutput(): void
	{
		const overlay = this.FindName(Grid, "ovl_output");
		overlay?.PointerDown.Add((_s, _a) =>
		{
			if (_a.Source === overlay)
				this.CloseOutput();
		});
		this.FindName(Button, "btn_output_close")?.Click.Add(() => { this.CloseOutput(); });
		this.FindName(Button, "btn_output_refresh")?.Click.Add(() => { void this.LoadOutputAsync(true); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋 저장 오버레이를 묶는다. 이름을 칠 때마다 같은 이름이 있는지 보고 [삭제]를 보인다.
	private BindPreset(): void
	{
		const overlay = this.FindName(Grid, "ovl_preset");
		overlay?.PointerDown.Add((_s, _a) =>
		{
			if (_a.Source === overlay)
				this.ClosePreset();
		});
		this.FindName(Button, "btn_preset_close")?.Click.Add(() => { this.ClosePreset(); });
		this.FindName(Button, "btn_preset_cancel")?.Click.Add(() => { this.ClosePreset(); });
		this.FindName(Button, "btn_preset_save")?.Click.Add(() => { this.SavePresetFromOverlay(); });
		this.FindName(Button, "btn_preset_delete")?.Click.Add(() => { void this.DeletePresetFromOverlayAsync(); });
		const name = this.FindName(TextBox, "txt_preset_name");
		name?.TextChanged.Add(() => { this.SetData("presetCanDelete", this.PresetExists(this.presetId_, name.Text.trim())); });
		// TextCommitted는 포커스를 잃을 때도 와서 [취소]를 눌러도 저장된다. Enter만 직접 잡는다.
		name?.KeyDown.Add((_s, _a) =>
		{
			if (_a.Key !== "Enter")
				return;
			_a.Handled = true;
			this.SavePresetFromOverlay();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 로그 패널을 묶는다. 범위(전체·선택한 스크립트)·자동 스크롤·지우기.
	private BindLog(): void
	{
		const scope = this.FindName(ComboBox, "cmb_log_scope");
		if (scope !== null)
		{
			scope.SetItems([...kLogScopeLabels]);
			scope.SelectedIndex = 0;
			scope.SelectionChanged.Add(() =>
			{
				this.logScopeAll_ = scope.SelectedIndex <= 0;
				this.RebuildLog();
			});
		}
		this.FindName(CheckBox, "chk_log_follow")?.Checked.Add(() => { this.ScrollLogToEnd(); });
		this.FindName(Button, "btn_log_clear")?.Click.Add(() => { void this.ClearLogAsync(); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// ESC로 오버레이를 닫고, Delete로 고른 항목을 지운다. 글자를 치는 중이면 Delete를 가로채지 않는다.
	private BindKeys(): void
	{
		this.PreviewKeyDown.Add((_s, _a) =>
		{
			const addOpen = this.data_.Get("isAddOpen") === true;
			const outputOpen = this.data_.Get("isOutputOpen") === true;
			const presetOpen = this.data_.Get("isPresetOpen") === true;
			if (_a.Key === "Escape")
			{
				if (addOpen)
				{
					this.CloseAdd();
					_a.Handled = true;
				}
				else if (outputOpen)
				{
					this.CloseOutput();
					_a.Handled = true;
				}
				else if (presetOpen)
				{
					this.ClosePreset();
					_a.Handled = true;
				}
				return;
			}
			if (_a.Key !== "Delete" || addOpen || outputOpen || presetOpen || _a.Source instanceof TextBox || this.selectedId_.length === 0)
				return;
			_a.Handled = true;
			void this.RemoveAsync(this.selectedId_);
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진 상태를 화면에 맞춘다. 구조가 바뀌었으면 행을 다시 만들고, 아니면 살아 있는 행만 고친다.
	// @param _nowMs: 기준 시각
	private Refresh(_nowMs: number): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		if (engine.Revision !== this.seenRevision_)
		{
			this.seenRevision_ = engine.Revision;
			this.Rebuild(engine);
		}
		let running = 0;
		let scheduled = 0;
		const entries = engine.Store.List();
		for (const entry of entries)
		{
			const state = engine.StateOf(entry);
			if (state === "Running")
				++running;
			else if (state === "Scheduled")
				++scheduled;
			const handle = this.rows_.get(entry.Id);
			if (handle !== undefined)
				MainControl.UpdateRow(handle, entry, state, _nowMs);
		}
		this.SetData("totalCount", entries.length);
		this.SetData("runningCount", running);
		this.SetData("scheduledCount", scheduled);
		this.SetData("isEmpty", entries.length === 0);
		const dot = this.FindName(StatusDot, "dot_state");
		if (dot !== null)
			dot.Status = running > 0 ? DotStatus.Busy : scheduled > 0 ? DotStatus.Ok : DotStatus.Idle;
		if (this.data_.Get("isOutputOpen") === true)
			void this.LoadOutputAsync(false);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행을 전부 다시 만든다. 지워진 항목을 고르고 있었으면 선택을 푼다.
	// @param _engine: 실행 엔진
	private Rebuild(_engine: RunnerEngine): void
	{
		const panel = this.rowsPanel_;
		if (panel === null)
			return;
		panel.ClearChildren();
		this.rows_.clear();
		const entries = _engine.Store.List();
		for (const entry of entries)
			panel.AddChild(this.MakeRow(entry));
		if (entries.every((_e) => _e.Id !== this.selectedId_))
			this.selectedId_ = "";
		this.ApplySelection();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 1개를 만든다. 버튼·점·남은 시간은 상태에 따라 바뀌므로 handle로 붙잡아 두고 UpdateRow가 고친다.
	// 인자 입력란은 글자가 바뀔 때마다 엔진에 값을 저장한다(예약 실행이 그 값을 쓴다).
	// @param _entry: 항목
	private MakeRow(_entry: IScriptEntry): UIElement
	{
		const id = _entry.Id;
		const row = new Grid();
		row.Name = `row_${id}`;
		row.SetValue(Grid.ColumnDefinitionsProperty, kRowColumns);
		row.Element.classList.add(kRowClass);
		const dot = new StatusDot();
		Grid.ColumnProperty.Set(dot, 0);
		const title = new TextBlock();
		title.Name = `txt_title_${id}`;
		title.Text = _entry.Title;
		title.Element.classList.add(kTitleClass);
		Grid.ColumnProperty.Set(title, 1);
		const preset = this.MakePresetCell(_entry);
		Grid.ColumnProperty.Set(preset, 2);
		const args = new WrapPanel();
		args.Orientation = Orientation.Horizontal;
		args.Element.classList.add(kArgsClass);
		Grid.ColumnProperty.Set(args, 3);
		const boxes: TextBox[] = [];
		_entry.Args.forEach((_arg: IScriptArg, _idx: number) =>
		{
			const box = new TextBox();
			box.Name = `txt_arg_${id}_${_idx}`;
			box.Width = kArgBoxWidth;
			box.Placeholder = _arg.Required ? `${_arg.Name} *` : _arg.Name;
			box.ToolTip = `${_arg.Name} (${_arg.Required ? "필수" : "선택"})`;
			box.Text = _arg.Value;
			box.TextChanged.Add(() => { MainControl.s_engine_?.SetArgValue(id, _idx, box.Text); });
			args.AddChild(box);
			boxes.push(box);
		});
		const run = new Button();
		run.Name = `btn_run_${id}`;
		Grid.ColumnProperty.Set(run, 4);
		run.Click.Add(() => { void this.ToggleRunAsync(id); });
		const remain = new TextBlock();
		remain.Name = `txt_remain_${id}`;
		remain.Element.classList.add(kRemainClass);
		Grid.ColumnProperty.Set(remain, 5);
		row.AddChild(dot);
		row.AddChild(title);
		row.AddChild(preset);
		row.AddChild(args);
		row.AddChild(run);
		row.AddChild(remain);
		row.PointerDown.Add(() => { this.SelectRow(id); });
		// 이 구독이 ContextMenu 설정보다 앞서야 한다. 메뉴는 열리는 순간의 상태(실행 중·예약)로 다시 만든다.
		row.ContextMenuOpening.Add(() =>
		{
			this.SelectRow(id);
			row.ContextMenu = this.MakeMenu(id);
		});
		row.ContextMenu = this.MakeMenu(id);
		const handle: IRowHandle = { Id: id, Root: row, Dot: dot, Title: title, Run: run, Remain: remain, Boxes: boxes, Running: null };
		this.rows_.set(id, handle);
		return row;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋 칸을 만든다. [콤보박스: 없음·프리셋들][저장]. 인자가 없는 스크립트는 빈 칸이다.
	// 콤보박스에서 고르면 그 값이 인자 입력란에 채워지고, 그대로 [즉시 실행]하면 그 값으로 돈다.
	// @param _entry: 항목
	private MakePresetCell(_entry: IScriptEntry): UIElement
	{
		const cell = new StackPanel();
		cell.Orientation = Orientation.Horizontal;
		cell.Element.classList.add(kPresetClass);
		if (_entry.Args.length === 0)
			return cell;
		const id = _entry.Id;
		const names = _entry.Presets.map((_p) => _p.Name);
		const combo = new ComboBox();
		combo.Name = `cmb_preset_${id}`;
		combo.Width = kPresetComboWidth;
		combo.ToolTip = "프리셋을 고르면 인자 입력란에 값을 채운다";
		combo.SetItems([kNoPresetLabel, ...names]);
		this.suppressPreset_ = true;
		combo.SelectedIndex = Math.max(0, names.indexOf(_entry.SelectedPreset) + 1);
		this.suppressPreset_ = false;
		combo.SelectionChanged.Add(() =>
		{
			if (this.suppressPreset_)
				return;
			const idx = combo.SelectedIndex;
			this.LoadPreset(id, idx <= 0 ? "" : names[idx - 1] ?? "");
		});
		// 닫힌 콤보박스의 기본 휠 동작은 선택을 돌리는 것이다. 목록을 스크롤하다 포인터가 지나가면
		// 프리셋이 바뀌어 인자 값이 덮어써지므로, 닫혀 있을 때는 선택 대신 목록을 스크롤한다.
		combo.PreviewWheel.Add((_s, _a) =>
		{
			if (combo.IsDropDownOpen)
				return;
			_a.Handled = true;
			MainControl.ScrollNearest(combo.Element, _a.DeltaY);
		});
		const save = new Button();
		save.Name = `btn_preset_save_${id}`;
		save.Content = "저장";
		save.Variant = "Default";
		save.ToolTip = "지금 인자 값을 프리셋으로 저장한다";
		save.Click.Add(() => { this.OpenPreset(id); });
		cell.AddChild(combo);
		cell.AddChild(save);
		return cell;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 우클릭 메뉴를 만든다. 실행 중이면 중지, 아니면 즉시 실행과 프리셋별 실행.
	// 예약 항목은 예약 해제·다시 걸기를 더한다.
	// @param _id: 항목 Id
	private MakeMenu(_id: string): ContextMenu
	{
		const menu = new ContextMenu();
		const engine = MainControl.s_engine_;
		const entry = engine?.Store.Find(_id) ?? null;
		if (engine === null || entry === null)
			return menu;
		if (engine.IsRunning(_id))
			menu.AddItem(MainControl.MakeMenuItem("중지", () => { void this.ToggleRunAsync(_id); }));
		else
		{
			menu.AddItem(MainControl.MakeMenuItem("즉시 실행", () => { void this.ToggleRunAsync(_id); }));
			for (const preset of entry.Presets)
				menu.AddItem(MainControl.MakeMenuItem(`프리셋 "${preset.Name}"로 실행`, () => { void this.ToggleRunAsync(_id, preset.Name); }));
		}
		menu.AddItem(MainControl.MakeMenuItem("실행 로그만 보기", () => { this.ShowLogOf(_id); }));
		menu.AddItem(MainControl.MakeMenuItem("출력 보기", () => { this.OpenOutput(_id); }));
		menu.AddItem(MainControl.MakeMenuItem("수정", () => { this.OpenAdd(entry); }));
		if (entry.Schedule.Enabled)
		{
			if (entry.NextDueAtMs > 0)
				menu.AddItem(MainControl.MakeMenuItem("예약 해제", () => { this.ApplyUpdate(_id, { Schedule: { ...entry.Schedule, Enabled: false, Repeat: false } }, "예약 해제"); }));
			else
				menu.AddItem(MainControl.MakeMenuItem("예약 다시 걸기", () => { this.Rearm(_id); }));
		}
		menu.AddItem(MainControl.MakeMenuItem("삭제", () => { void this.RemoveAsync(_id); }, "Del"));
		return menu;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 즉시 실행 또는 중지. 프리셋을 주면 그 값을 불러와 실행한다. 실행이 거부되면(필수 인자 비었음 등) 이유를 알린다.
	// @param _id: 항목 Id
	// @param _preset: 불러와 실행할 프리셋 이름(""이면 지금 값으로 실행)
	private async ToggleRunAsync(_id: string, _preset: string = ""): Promise<void>
	{
		const engine = MainControl.s_engine_;
		const entry = engine?.Store.Find(_id) ?? null;
		if (engine === null || entry === null)
			return;
		this.SelectRow(_id);
		if (engine.IsRunning(_id))
		{
			this.SetState(`중지 중: ${entry.Title}`);
			await engine.StopAsync(_id);
			this.SetState(`중지: ${entry.Title}`);
			return;
		}
		const outcome = engine.Run(_id, "Manual", undefined, _preset.length > 0 ? _preset : undefined);
		if (!outcome.Ok)
		{
			this.SetState(outcome.Error);
			MainControl.s_ports_?.Alert("실행할 수 없습니다", `${entry.Title}\n${outcome.Error}`);
			this.FocusMissingArg(entry);
			return;
		}
		this.SetState(`실행: ${entry.Title}`);
		const record = await outcome.Done;
		this.SetState(`${entry.Title} — ${ScriptFormat.ResultText(record)}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 비어 있는 첫 필수 인자 입력란에 포커스를 넣는다.
	// @param _entry: 항목
	private FocusMissingArg(_entry: IScriptEntry): void
	{
		const handle = this.rows_.get(_entry.Id);
		const idx = _entry.Args.findIndex((_a) => _a.Required && _a.Value.trim().length === 0);
		const box = idx >= 0 ? handle?.Boxes[idx] : undefined;
		if (box !== undefined)
			requestAnimationFrame(() => { box.Focus(); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 중인 것을 전부 중지한다.
	private async StopAllAsync(): Promise<void>
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		this.SetState("모두 중지하는 중");
		const count = await engine.StopAllAsync();
		this.SetState(`${count}개 중지`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 확인을 받고 항목을 지운다. 실행 중이면 엔진이 먼저 중지한다.
	// @param _id: 항목 Id
	private async RemoveAsync(_id: string): Promise<void>
	{
		const engine = MainControl.s_engine_;
		const entry = engine?.Store.Find(_id) ?? null;
		if (engine === null || entry === null)
			return;
		const running = engine.IsRunning(_id) ? "\n실행 중이라 먼저 중지합니다." : "";
		const ok = await (MainControl.s_ports_?.Confirm(`"${entry.Title}"을 목록에서 삭제할까요? 스크립트 파일은 지우지 않습니다.${running}`) ?? Promise.resolve(true));
		if (!ok)
			return;
		await engine.RemoveAsync(_id);
		this.SetState(`삭제: ${entry.Title}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약을 지금 기준으로 다시 건다.
	// @param _id: 항목 Id
	private Rearm(_id: string): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const outcome = engine.Rearm(_id);
		if (!outcome.Ok)
		{
			MainControl.s_ports_?.Alert("예약할 수 없습니다", outcome.Error);
			return;
		}
		this.SetState(`예약: ${outcome.Entry.Title} — ${ScriptFormat.Clock(outcome.Entry.NextDueAtMs, Date.now())}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진 Update를 부르고 결과를 상태줄·알림으로 보인다.
	// @param _id: 항목 Id
	// @param _patch: 바꿀 필드
	// @param _label: 상태줄 앞머리
	private ApplyUpdate(_id: string, _patch: { Schedule: IScriptSchedule }, _label: string): void
	{
		const outcome = MainControl.s_engine_?.Update(_id, _patch);
		if (outcome === undefined)
			return;
		if (!outcome.Ok)
		{
			MainControl.s_ports_?.Alert("바꿀 수 없습니다", outcome.Error);
			return;
		}
		this.SetState(`${_label}: ${outcome.Entry.Title}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행을 고른다. 행을 다시 만들지 않고 선택 클래스만 갈아 끼운다.
	// @param _id: 항목 Id
	private SelectRow(_id: string): void
	{
		const changed = this.selectedId_ !== _id;
		this.selectedId_ = _id;
		this.ApplySelection();
		if (changed && !this.logScopeAll_)
			this.RebuildLog();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고른 행에만 선택 클래스를 남긴다.
	private ApplySelection(): void
	{
		for (const handle of this.rows_.values())
			handle.Root.Element.classList.toggle(kSelectedClass, handle.Id === this.selectedId_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋을 불러온다(콤보박스 선택). 빈 이름은 "없음" 선택이고 값은 그대로 둔다.
	// @param _id: 항목 Id
	// @param _name: 프리셋 이름
	private LoadPreset(_id: string, _name: string): void
	{
		const outcome = MainControl.s_engine_?.ApplyPreset(_id, _name);
		if (outcome === undefined)
			return;
		if (!outcome.Ok)
		{
			MainControl.s_ports_?.Alert("프리셋을 불러올 수 없습니다", outcome.Error);
			return;
		}
		this.SelectRow(_id);
		this.SetState(_name.length > 0 ? `프리셋 불러옴: ${outcome.Entry.Title} — ${_name}` : `프리셋 선택 해제: ${outcome.Entry.Title}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋 저장 오버레이를 연다. 이름은 지금 고른 프리셋으로 채워(덮어쓰기) 두고, 저장할 값을 보여 준다.
	// @param _id: 항목 Id
	private OpenPreset(_id: string): void
	{
		const entry = MainControl.s_engine_?.Store.Find(_id) ?? null;
		if (entry === null)
			return;
		this.SelectRow(_id);
		this.presetId_ = _id;
		this.SetData("presetHead", `프리셋 저장 — ${entry.Title}`);
		this.SetData("presetValues", entry.Args.map((_a) => `${_a.Name} = ${_a.Value.length > 0 ? _a.Value : "(빈 값)"}`).join("  ·  "));
		this.SetText("txt_preset_name", entry.SelectedPreset);
		this.SetData("presetCanDelete", this.PresetExists(_id, entry.SelectedPreset));
		this.SetData("isPresetOpen", true);
		this.FocusLater(() => this.FindName(TextBox, "txt_preset_name"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 프리셋 저장 오버레이를 닫는다.
	private ClosePreset(): void
	{
		this.presetId_ = "";
		this.SetData("isPresetOpen", false);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 오버레이 이름으로 지금 인자 값을 저장한다. 같은 이름이 있으면 덮어쓴다.
	private SavePresetFromOverlay(): void
	{
		if (this.data_.Get("isPresetOpen") !== true || this.presetId_.length === 0)
			return;
		const name = this.TextOf("txt_preset_name");
		const outcome = MainControl.s_engine_?.SavePreset(this.presetId_, name);
		if (outcome === undefined)
			return;
		if (!outcome.Ok)
		{
			MainControl.s_ports_?.Alert("프리셋을 저장할 수 없습니다", outcome.Error);
			return;
		}
		this.ClosePreset();
		this.SetState(`프리셋 저장: ${outcome.Entry.Title} — ${name}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 오버레이 이름의 프리셋을 확인 후 지운다.
	private async DeletePresetFromOverlayAsync(): Promise<void>
	{
		const id = this.presetId_;
		const name = this.TextOf("txt_preset_name");
		if (id.length === 0 || !this.PresetExists(id, name))
			return;
		const ok = await (MainControl.s_ports_?.Confirm(`"${name}" 프리셋을 삭제할까요?`) ?? Promise.resolve(true));
		if (!ok)
			return;
		const outcome = MainControl.s_engine_?.DeletePreset(id, name);
		if (outcome === undefined)
			return;
		if (!outcome.Ok)
		{
			MainControl.s_ports_?.Alert("프리셋을 삭제할 수 없습니다", outcome.Error);
			return;
		}
		this.ClosePreset();
		this.SetState(`프리셋 삭제: ${outcome.Entry.Title} — ${name}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그 항목에 같은 이름의 프리셋이 있는지 본다.
	// @param _id: 항목 Id
	// @param _name: 프리셋 이름
	private PresetExists(_id: string, _name: string): boolean
	{
		if (_name.length === 0)
			return false;
		return MainControl.s_engine_?.Store.Find(_id)?.Presets.some((_p) => _p.Name === _name) ?? false;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그 항목의 실행 로그만 보이게 범위를 바꾼다.
	// @param _id: 항목 Id
	private ShowLogOf(_id: string): void
	{
		this.SelectRow(_id);
		const scope = this.FindName(ComboBox, "cmb_log_scope");
		if (scope !== null && scope.SelectedIndex !== 1)
			scope.SelectedIndex = 1;
		this.logScopeAll_ = false;
		this.RebuildLog();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 지금 범위의 로그 항목 Id. 전체면 "".
	private LogScopeId(): string
	{
		return this.logScopeAll_ ? "" : this.selectedId_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그 상자의 textarea. 줄을 덧붙일 때 선택 영역을 지키려고 DOM을 직접 다룬다.
	private LogArea(): HTMLTextAreaElement | null
	{
		return this.FindName(TextBox, "txt_log")?.Element.querySelector("textarea") ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그 상자를 범위에 맞춰 통째로 다시 채운다(불러오기·지우기·범위 변경·줄 수 초과).
	private RebuildLog(): void
	{
		const log = MainControl.s_log_;
		const area = this.LogArea();
		if (log === null || area === null)
			return;
		if (!this.logScopeAll_ && this.selectedId_.length === 0)
		{
			area.value = "";
			this.logLineCount_ = 0;
			this.SetData("logInfo", "목록에서 스크립트를 고르면 그 로그만 보입니다");
			return;
		}
		const lines = log.List(this.LogScopeId(), kViewLogLines).map((_l) => RunLog.Format(_l));
		area.value = lines.join("\n");
		this.logLineCount_ = lines.length;
		this.UpdateLogInfo();
		this.ScrollLogToEnd();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 새 줄을 로그 상자 끝에 덧붙인다. 범위 밖 줄은 버린다. 선택 영역은 그대로 둔다.
	// @param _added: 새로 쌓인 줄
	private AppendLog(_added: ReadonlyArray<IRunLogLine>): void
	{
		const area = this.LogArea();
		if (area === null || (!this.logScopeAll_ && this.selectedId_.length === 0))
			return;
		const scope = this.LogScopeId();
		const lines = _added.filter((_l) => scope.length === 0 || _l.EntryId === scope).map((_l) => RunLog.Format(_l));
		if (lines.length === 0)
			return;
		this.logLineCount_ += lines.length;
		if (this.logLineCount_ > kViewLogLines * 1.25)
		{
			this.RebuildLog();
			return;
		}
		const end = area.value.length;
		area.setRangeText((end > 0 ? "\n" : "") + lines.join("\n"), end, end, "preserve");
		this.UpdateLogInfo();
		if (this.CheckOf("chk_log_follow"))
			this.ScrollLogToEnd();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그 상자를 맨 아래로 내린다. 자동 스크롤이 꺼져 있으면 아무것도 하지 않는다.
	private ScrollLogToEnd(): void
	{
		const area = this.LogArea();
		if (area !== null && this.CheckOf("chk_log_follow"))
			area.scrollTop = area.scrollHeight;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그 머리의 범위·줄 수 문구를 맞춘다.
	private UpdateLogInfo(): void
	{
		const entry = this.logScopeAll_ ? null : MainControl.s_engine_?.Store.Find(this.selectedId_) ?? null;
		const scope = this.logScopeAll_ ? "전체" : entry?.Title ?? this.selectedId_;
		const more = this.logLineCount_ >= kViewLogLines ? ` (최근 ${kViewLogLines}줄)` : "";
		this.SetData("logInfo", `${scope} · ${this.logLineCount_}줄${more}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 확인을 받고 실행 로그를 전부 지운다(파일 포함).
	private async ClearLogAsync(): Promise<void>
	{
		const log = MainControl.s_log_;
		if (log === null)
			return;
		const ok = await (MainControl.s_ports_?.Confirm("실행 로그를 전부 지울까요? 저장된 로그 파일도 비웁니다.") ?? Promise.resolve(true));
		if (!ok)
			return;
		log.Clear();
		this.SetState("실행 로그를 지웠습니다");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 오버레이를 연다. 항목을 주면 수정 모드로 채운다.
	// @param _editing: 수정할 항목(새로 만들면 null)
	private OpenAdd(_editing: IScriptEntry | null): void
	{
		this.editingId_ = _editing === null ? "" : _editing.Id;
		this.FillForm(_editing);
		this.SetData("addHead", _editing === null ? "스크립트 등록" : `스크립트 수정 — ${_editing.Id}`);
		this.SetData("saveText", _editing === null ? "등록" : "수정 저장");
		this.SetData("isOutputOpen", false);
		this.SetData("isAddOpen", true);
		this.FocusLater(() => this.FindName(TextBox, "txt_path"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록 오버레이를 닫는다. 수정 모드도 함께 푼다.
	private CloseAdd(): void
	{
		this.editingId_ = "";
		this.SetData("isAddOpen", false);
		this.FocusLater(() => this.FindName(Button, "btn_add"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼을 채운다. null이면 기본값(제목 "스크립트-N", 5분 뒤, 인자 없음)으로 비운다.
	// @param _editing: 수정할 항목(새로 만들면 null)
	private FillForm(_editing: IScriptEntry | null): void
	{
		const engine = MainControl.s_engine_;
		const defaultTitle = engine?.Store.DefaultTitle() ?? "스크립트-1";
		this.SetText("txt_title", _editing === null ? defaultTitle : _editing.Title);
		const titleBox = this.FindName(TextBox, "txt_title");
		if (titleBox !== null)
			titleBox.Placeholder = defaultTitle;
		this.SetText("txt_path", _editing === null ? "" : _editing.Path);
		this.ClearFormArgs();
		for (const arg of _editing?.Args ?? [])
			this.AddFormArg(arg);
		const schedule = _editing?.Schedule ?? null;
		const enabled = schedule !== null && schedule.Enabled;
		const isAt = schedule !== null && schedule.Kind === "At";
		this.SetCheck("chk_schedule", enabled);
		this.SetData("isScheduled", enabled);
		const radio = this.FindName(RadioButton, isAt ? "radio_at" : "radio_after");
		if (radio !== null)
			radio.IsChecked = true;
		this.SetData("isAt", isAt);
		const offset = schedule !== null && schedule.Kind === "After" && schedule.OffsetSec > 0 ? Math.round(schedule.OffsetSec) : 300;
		this.SetNumber("num_hour", Math.floor(offset / 3600));
		this.SetNumber("num_min", Math.floor((offset % 3600) / 60));
		this.SetNumber("num_sec", offset % 60);
		const parts = schedule !== null && isAt ? ScheduleCalc.ParseAtTime(schedule.AtTime) : null;
		this.SetText("txt_at_date", parts !== null && parts.HasDate ? `${parts.Year}-${Pad2(parts.Month)}-${Pad2(parts.Day)}` : "");
		this.SetText("txt_at_time", parts !== null ? `${Pad2(parts.Hour)}:${Pad2(parts.Minute)}` : "");
		this.SetCheck("chk_repeat", schedule !== null && schedule.Enabled && schedule.Repeat);
		this.SetCheck("chk_keep_boot", _editing !== null && _editing.KeepAfterBoot);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼 인자 행 1개를 붙인다. [이름][기본값][필수][삭제] 순서다.
	// @param _arg: 채울 값
	private AddFormArg(_arg: IScriptArg): IFormArg
	{
		const panel = this.FindName(StackPanel, "pnl_args");
		const idx = this.formArgs_.length;
		const row = new Grid();
		row.Name = `grid_form_arg_${idx}`;
		row.SetValue(Grid.ColumnDefinitionsProperty, "*,*,Auto,Auto");
		row.Element.style.columnGap = "6px";
		row.Element.style.alignItems = "center";
		const name = new TextBox();
		name.Name = `txt_form_arg_name_${idx}`;
		name.Placeholder = `인자 ${idx + 1} 이름 (예: Branch)`;
		name.Text = _arg.Name;
		Grid.ColumnProperty.Set(name, 0);
		const value = new TextBox();
		value.Name = `txt_form_arg_value_${idx}`;
		value.Placeholder = "값 (선택)";
		value.Text = _arg.Value;
		Grid.ColumnProperty.Set(value, 1);
		const required = new CheckBox();
		required.Name = `chk_form_arg_required_${idx}`;
		required.Content = "필수";
		required.IsChecked = _arg.Required;
		required.ToolTip = "필수 인자가 비어 있으면 실행하지 않는다";
		Grid.ColumnProperty.Set(required, 2);
		const remove = new Button();
		remove.Name = `btn_form_arg_remove_${idx}`;
		remove.Variant = "Ghost";
		remove.Icon = "x";
		remove.ToolTip = "이 인자 삭제";
		Grid.ColumnProperty.Set(remove, 3);
		row.AddChild(name);
		row.AddChild(value);
		row.AddChild(required);
		row.AddChild(remove);
		const arg: IFormArg = { Root: row, Name: name, Value: value, Required: required };
		remove.Click.Add(() => { this.RemoveFormArg(arg); });
		panel?.AddChild(row);
		this.formArgs_.push(arg);
		this.SetData("argCount", this.formArgs_.length);
		return arg;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼 인자 행 1개를 뺀다.
	// @param _arg: 뺄 행
	private RemoveFormArg(_arg: IFormArg): void
	{
		this.formArgs_ = this.formArgs_.filter((_a) => _a !== _arg);
		this.FindName(StackPanel, "pnl_args")?.RemoveChild(_arg.Root, true);
		this.formArgs_.forEach((_a, _idx) => { _a.Name.Placeholder = `인자 ${_idx + 1} 이름 (예: Branch)`; });
		this.SetData("argCount", this.formArgs_.length);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼 인자 행을 전부 뺀다.
	private ClearFormArgs(): void
	{
		this.FindName(StackPanel, "pnl_args")?.ClearChildren();
		this.formArgs_ = [];
		this.SetData("argCount", 0);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼을 읽어 등록 정보로 굳힌다. 입력이 모자라면 어느 칸이 왜 틀렸는지 돌려준다.
	private ReadForm(): TFormOutcome
	{
		const path = this.TextOf("txt_path");
		if (path.length === 0)
			return { Ok: false, Error: "스크립트 경로가 비어 있습니다. 실행할 파일 경로를 입력하세요. (예: C:\\Tools\\build.ps1)" };
		const args: IScriptArg[] = [];
		for (let idx = 0; idx < this.formArgs_.length; ++idx)
		{
			const item = this.formArgs_[idx] as IFormArg;
			const name = item.Name.Text.trim();
			if (name.length === 0)
				return { Ok: false, Error: `${idx + 1}번째 인자의 이름이 비어 있습니다. 이름을 넣거나 [x]로 지우세요.` };
			args.push({ Name: name, Required: item.Required.IsChecked, Value: item.Value.Text });
		}
		const enabled = this.CheckOf("chk_schedule");
		const isAt = this.data_.Get("isAt") === true;
		const schedule: IScriptSchedule = {
			Enabled: enabled,
			Kind: isAt ? "At" : "After",
			OffsetSec: this.NumberOf("num_hour") * 3600 + this.NumberOf("num_min") * 60 + this.NumberOf("num_sec"),
			AtTime: "",
			Repeat: enabled && this.CheckOf("chk_repeat"),
		};
		if (enabled && isAt)
		{
			const date = this.TextOf("txt_at_date");
			const time = this.TextOf("txt_at_time");
			const bad = MainControl.CheckAtTime(date, time);
			if (bad.length > 0)
				return { Ok: false, Error: bad };
			schedule.AtTime = date.length > 0 ? `${date} ${time}` : time;
		}
		else if (enabled && schedule.OffsetSec < 1)
		{
			return { Ok: false, Error: "시·분·초가 모두 0입니다. 시간 뒤 예약은 1초 이상이어야 합니다. (예: 0시간 5분 0초)" };
		}
		return { Ok: true, Spec: { Title: this.TextOf("txt_title"), Path: path, Args: args, Schedule: schedule, KeepAfterBoot: enabled && this.CheckOf("chk_keep_boot") } };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼을 저장한다. 새로 만들면 등록, 수정이면 바뀐 필드만 고친다(예약이 그대로면 남은 시간도 그대로 둔다).
	private SaveForm(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const form = this.ReadForm();
		if (!form.Ok)
		{
			MainControl.s_ports_?.Alert("입력을 확인하세요", form.Error);
			return;
		}
		const spec = form.Spec;
		const editing = this.editingId_.length > 0 ? engine.Store.Find(this.editingId_) : null;
		if (editing === null)
		{
			const outcome = engine.Register(spec);
			if (!outcome.Ok)
			{
				MainControl.s_ports_?.Alert("등록할 수 없습니다", outcome.Error);
				return;
			}
			this.SelectRow(outcome.Entry.Id);
			this.SetState(MainControl.SavedText("등록", outcome.Entry));
		}
		else
		{
			const sameSchedule = JSON.stringify(spec.Schedule) === JSON.stringify(editing.Schedule);
			const outcome = engine.Update(editing.Id, {
				Title: spec.Title,
				Path: spec.Path,
				Args: spec.Args,
				Schedule: sameSchedule ? undefined : spec.Schedule,
				KeepAfterBoot: spec.KeepAfterBoot,
			});
			if (!outcome.Ok)
			{
				MainControl.s_ports_?.Alert("수정할 수 없습니다", outcome.Error);
				return;
			}
			this.SetState(MainControl.SavedText("수정", outcome.Entry));
		}
		this.CloseAdd();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 출력 오버레이를 연다.
	// @param _id: 항목 Id
	private OpenOutput(_id: string): void
	{
		this.outputId_ = _id;
		this.outputKey_ = "";
		this.SetText("txt_output", "");
		this.SetData("isAddOpen", false);
		this.SetData("isOutputOpen", true);
		void this.LoadOutputAsync(true);
		this.FocusLater(() => this.FindName(Button, "btn_output_close"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 출력 오버레이를 닫는다.
	private CloseOutput(): void
	{
		this.outputId_ = "";
		this.SetData("isOutputOpen", false);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 출력 로그를 읽어 보인다. 실행 중이거나 실행 기록이 바뀌었을 때만 다시 읽는다(강제면 항상).
	// 읽는 도중 다음 tick이 오면 겹쳐 읽지 않는다.
	// @param _force: 조건과 무관하게 다시 읽을지
	private async LoadOutputAsync(_force: boolean): Promise<void>
	{
		const engine = MainControl.s_engine_;
		const entry = engine?.Store.Find(this.outputId_) ?? null;
		if (engine === null || entry === null || this.outputBusy_)
			return;
		const running = engine.IsRunning(entry.Id);
		const key = `${entry.LastRun?.RunId ?? ""}:${entry.LastRun?.Result ?? ""}`;
		if (!_force && !running && key === this.outputKey_)
			return;
		this.outputBusy_ = true;
		try
		{
			const output = await engine.ReadOutputAsync(entry.Id, kOutputChars);
			if (this.outputId_ !== entry.Id)
				return;
			this.outputKey_ = key;
			this.SetData("outputHead", `출력 — ${entry.Title}`);
			this.SetData("outputMeta", MainControl.OutputMeta(entry, running, output.Truncated, output.TotalChars));
			const box = this.FindName(TextBox, "txt_output");
			if (box !== null && box.Text !== output.Text)
			{
				box.Text = output.Text.length > 0 ? output.Text : "(출력 없음)";
				const area = box.Element.querySelector("textarea");
				if (area !== null)
					area.scrollTop = area.scrollHeight;
			}
		}
		finally
		{
			this.outputBusy_ = false;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 한 프레임 뒤에 포커스를 넣는다. Data 변경 → 바인딩 재평가가 microtask라서
	// 지금 당장은 오버레이가 아직 숨어 있고, 숨은 요소에는 포커스가 들어가지 않는다.
	// @param _pick: 포커스를 줄 요소를 찾는 함수
	private FocusLater(_pick: () => UIElement | null): void
	{
		requestAnimationFrame(() => { _pick()?.Focus(); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트 상자 값을 구한다. 없으면 빈 문자열.
	// @param _name: 컨트롤 이름
	private TextOf(_name: string): string
	{
		return this.FindName(TextBox, _name)?.Text.trim() ?? "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트 상자 값을 넣는다.
	// @param _name: 컨트롤 이름
	// @param _text: 넣을 값
	private SetText(_name: string, _text: string): void
	{
		const box = this.FindName(TextBox, _name);
		if (box !== null)
			box.Text = _text;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 숫자 상자 값을 넣는다.
	// @param _name: 컨트롤 이름
	// @param _value: 넣을 값
	private SetNumber(_name: string, _value: number): void
	{
		const box = this.FindName(NumericUpDown, _name);
		if (box !== null)
			box.Value = _value;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 숫자 상자 값을 구한다. 없으면 0.
	// @param _name: 컨트롤 이름
	private NumberOf(_name: string): number
	{
		const value = this.FindName(NumericUpDown, _name)?.Value ?? 0;
		return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 체크 상자 값을 넣는다.
	// @param _name: 컨트롤 이름
	// @param _on: 켤지
	private SetCheck(_name: string, _on: boolean): void
	{
		const box = this.FindName(CheckBox, _name);
		if (box !== null)
			box.IsChecked = _on;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 체크 상자 값을 구한다. 없으면 false.
	// @param _name: 컨트롤 이름
	private CheckOf(_name: string): boolean
	{
		return this.FindName(CheckBox, _name)?.IsChecked ?? false;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태줄 문구를 바꾼다.
	// @param _text: 문구
	private SetState(_text: string): void
	{
		this.SetData("stateText", _text);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값이 달라졌을 때만 바인딩을 건드린다. tick마다 전체 재바인딩을 피하려는 것이다.
	// @param _key: Data 키
	// @param _value: 값
	private SetData(_key: string, _value: unknown): void
	{
		if (this.data_.Get(_key) === _value)
			return;
		this.data_.Set(_key, _value);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 1개의 버튼·점·남은 시간·툴팁을 상태에 맞춘다. 실행 여부가 그대로면 버튼은 건드리지 않는다.
	// @param _handle: 행 핸들
	// @param _entry: 항목
	// @param _state: 항목 상태
	// @param _nowMs: 기준 시각
	private static UpdateRow(_handle: IRowHandle, _entry: IScriptEntry, _state: TEntryState, _nowMs: number): void
	{
		const running = _state === "Running";
		if (_handle.Running !== running)
		{
			_handle.Running = running;
			_handle.Run.Content = running ? "중지" : "즉시 실행";
			_handle.Run.Variant = running ? "Danger" : "Default";
			_handle.Run.Icon = running ? "square" : "play";
			_handle.Run.ToolTip = running ? "실행 중인 스크립트를 중지한다(자식 프로세스까지)" : "지금 바로 한 번 실행한다";
		}
		const dot = MainControl.DotOf(_entry, _state);
		if (_handle.Dot.Status !== dot)
			_handle.Dot.Status = dot;
		const remain = ScriptFormat.RemainText(_entry, _state, _nowMs);
		if (_handle.Remain.Text !== remain)
			_handle.Remain.Text = remain;
		const tip = ScriptFormat.Tip(_entry, _nowMs);
		if (_handle.Title.ToolTip !== tip)
			_handle.Title.ToolTip = tip;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태에 맞는 점 색을 고른다. 실행 중은 Busy, 마지막 실행이 실패·오류면 Error, 예약이면 Ok.
	// @param _entry: 항목
	// @param _state: 항목 상태
	private static DotOf(_entry: IScriptEntry, _state: TEntryState): DotStatus
	{
		if (_state === "Running")
			return DotStatus.Busy;
		const result = _entry.LastRun?.Result ?? "";
		if (result === "Failed" || result === "Error" || _entry.MissedAtMs > 0)
			return DotStatus.Error;
		if (_state === "Scheduled")
			return DotStatus.Ok;
		return result === "Stopped" ? DotStatus.Warn : DotStatus.Idle;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장 결과 문구. 예약이 걸렸으면 다음 실행 시각을 붙인다.
	// @param _verb: "등록" 또는 "수정"
	// @param _entry: 항목
	private static SavedText(_verb: string, _entry: IScriptEntry): string
	{
		if (_entry.NextDueAtMs <= 0)
			return `${_verb}: ${_entry.Title}`;
		return `${_verb}: ${_entry.Title} — 다음 실행 ${ScriptFormat.Clock(_entry.NextDueAtMs, Date.now())} (${ScheduleCalc.Describe(_entry.Schedule)})`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 출력 오버레이 머리 문구. 실행 계기·시각·결과·잘림 여부를 한 줄로 묶는다.
	// @param _entry: 항목
	// @param _running: 실행 중인지
	// @param _truncated: 앞부분을 잘랐는지
	// @param _total: 전체 글자 수
	private static OutputMeta(_entry: IScriptEntry, _running: boolean, _truncated: boolean, _total: number): string
	{
		const record = _entry.LastRun;
		if (record === null)
			return `${_entry.Path} — 아직 실행한 적이 없습니다.`;
		const now = Date.now();
		const trigger = record.Trigger === "Schedule" ? "예약" : record.Trigger === "Mcp" ? "MCP" : "수동";
		const parts = [`${record.RunId} (${trigger})`, `시작 ${ScriptFormat.Clock(record.StartedAtMs, now)}`];
		if (_running)
			parts.push(`실행 중 ${ScriptFormat.Span(now - record.StartedAtMs)}`);
		else
			parts.push(`${ScriptFormat.ResultText(record)} · ${ScriptFormat.Span(record.EndedAtMs - record.StartedAtMs)}`);
		if (record.Args.length > 0)
			parts.push(`인자: ${record.Args.join(" ")}`);
		if (_truncated)
			parts.push(`앞부분 생략(전체 ${_total}자)`);
		if (record.Error.length > 0)
			parts.push(`오류: ${record.Error}`);
		return parts.join(" · ");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 날짜·시각 입력을 검사한다. 통과하면 "". 어느 칸이 왜 틀렸는지 짚어 준다.
	// @param _date: 날짜 칸(비어도 된다)
	// @param _time: 시각 칸
	private static CheckAtTime(_date: string, _time: string): string
	{
		if (_time.length === 0)
			return "시각이 비어 있습니다. HH:mm 24시간 형식으로 입력하세요. (예: 22:10)";
		if (ScheduleCalc.ParseAtTime(_time) === null)
			return `시각 "${_time}"은 형식이 잘못됐습니다. HH:mm 24시간 형식이어야 합니다. (예: 09:05, 22:10)`;
		if (_date.length > 0 && !ScheduleCalc.IsValidDate(_date))
			return `날짜 "${_date}"는 형식이 잘못됐거나 없는 날짜입니다. YYYY-MM-DD 형식이어야 합니다. (예: 2026-11-12)`;
		return "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 메뉴 항목 1개를 만든다. ContextMenu는 XML로 선언할 수 없어 코드로만 만든다.
	// @param _header: 표시 문구
	// @param _run: 눌렀을 때 할 일
	// @param _gesture: 오른쪽에 붙일 단축키 문구(없으면 생략)
	private static MakeMenuItem(_header: string, _run: () => void, _gesture: string = ""): MenuItem
	{
		const item = new MenuItem();
		item.Header = _header;
		if (_gesture.length > 0)
			item.InputGestureText = _gesture;
		item.Click.Add(() => { _run(); });
		return item;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 요소에서 가장 가까운 세로 스크롤 조상을 찾아 그만큼 내린다(휠을 대신 넘길 때 쓴다).
	// @param _from: 시작 요소
	// @param _deltaY: 휠 양
	private static ScrollNearest(_from: HTMLElement, _deltaY: number): void
	{
		let node = _from.parentElement;
		while (node !== null)
		{
			const overflow = getComputedStyle(node).overflowY;
			if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight)
			{
				node.scrollTop += _deltaY;
				return;
			}
			node = node.parentElement;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 보정 CSS를 문서에 1회 주입한다.
	private static EnsureStyle(): void
	{
		if (document.getElementById(kStyleId) !== null)
			return;
		const style = document.createElement("style");
		style.id = kStyleId;
		style.textContent = kViewCss;
		document.head.append(style);
	}
}
