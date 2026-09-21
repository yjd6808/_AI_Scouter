/*
	작성자: 윤정도
	생성일: 2026-09-16
	=====
	설명: InstantAlarm 메인 화면. 엔진의 구독자일 뿐이라 이 화면이 없어도 엔진은 혼자 돈다.
	      남은 시간은 화면에 보관하지 않고 매 tick engine.RemainingMs()로 파생한다.
	      오버레이 2종은 루트 Grid의 같은 칸에 겹쳐 두고 Visibility로 토글한다.
*/

import { UserControl, Button, TextBox, ListBox, ComboBox, CheckBox, RadioButton, NumericUpDown } from "@scouter/gui";
import { VirtualList, PropertyGrid, StackPanel, TextBlock, Badge, StatusDot, DotStatus, Grid, Visibility, Orientation } from "@scouter/gui";
import { ContextMenu, MenuItem } from "@scouter/gui";
import type { DataList, IJsonSchemaNode, UIElement } from "@scouter/gui";
import { AlarmEngine, ParseAtTime } from "../AlarmEngine";
import { AlarmFormat } from "../AlarmFormat";
import { SpecFactory } from "../SpecFactory";
import type { IAlarmGroup, IAlarmOptions, IAlarmSpec, IAlarmViewPorts, IArmedAlarm, TAlarmFilter } from "../Types";

const kSnoozeSec = 300;
const kHourSec = 3600;
const kRowHeight = 30;
// 행 컬럼 폭(px). 전부 고정이라 어느 행에서나 같은 컬럼이 같은 x에서 시작한다.
// StackPanel이 자식에 flex: 0 0 auto를 박으므로 width만 주면 줄어들지 않는다.
// kColDot은 행 맨 앞 StatusDot(.gui-dot 8px 고정) 자리다. 헤더가 같은 폭을 비워야 컬럼이 맞는다.
const kColDot = 8;
const kColClock = 64;
const kColTitle = 200;
const kColState = 80;
const kColRemain = 150;
// 목록 구분 키. 같은 예약이 두 목록에 동시에 뜰 수 있어 행 캐시 키에 목록을 섞는다.
const kArmedKey = "armed";
const kHistoryKey = "history";
const kStyleId = "instantalarm-view-style";
const kViewClass = "instantalarm-view";
const kRowClass = "instantalarm-row";
const kHeadClass = "instantalarm-head";
const kSelectedClass = "is-selected";
// TabControl 본문과 VirtualList에는 프레임워크 CSS가 없어 그대로 두면 높이가 0이 된다.
// (P4Util lst_files 28px, ControlLab virtual_demo 0px가 같은 증상이다)
// Gui를 고칠 수 없으므로 이 화면 범위로만 한정한 보정 규칙을 1회 주입한다.
// 뒤쪽 절반은 목록 헤더·행 선택 표시다. 행은 코드로 만들어 XML 스타일을 못 받으므로 여기로 모은다.
// 색은 전부 테마 CSS 변수를 쓴다. 리터럴 색은 쓰지 않는다.
const kViewCss = `
.${kViewClass} .gui-tabcontrol { flex: 1 1 auto; min-height: 0; }
.${kViewClass} .gui-tabcontrol__content { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.${kViewClass} .gui-tabpage:not([hidden]) { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.${kViewClass} .gui-virtual { flex: 1 1 auto; min-height: 0; display: flex; }
.${kViewClass} .gui-virtual__viewport { flex: 1 1 auto; min-height: 0; width: 100%; overflow-y: auto; }
.${kViewClass} .gui-virtual__spacer { position: relative; width: 100%; }
.${kViewClass} .gui-grid > [data-testid="pnl_add"], .${kViewClass} .gui-grid > [data-testid="pnl_settings"] { align-self: center; }
.${kViewClass} .gui-grid > [data-testid="ovl_add"], .${kViewClass} .gui-grid > [data-testid="ovl_settings"] { position: relative; z-index: 1; }
.${kViewClass} .${kHeadClass} { flex: none; align-items: center; padding: 2px 6px 4px 6px; border-bottom: 1px solid var(--border-weak-base); }
.${kViewClass} .${kHeadClass} .gui-text { color: var(--text-weak); font-size: var(--gui-font-sm, 12px); }
.${kViewClass} .${kRowClass} { cursor: pointer; }
.${kViewClass} .${kRowClass}:hover { background: var(--background-hover); }
.${kViewClass} .${kRowClass}.${kSelectedClass} { background: var(--primary-muted); }
.${kViewClass} .gui-virtual:focus-visible { outline: 1px solid var(--primary); outline-offset: -1px; }
.${kViewClass} .gui-virtual:focus-visible .${kRowClass}.${kSelectedClass} { box-shadow: inset 0 0 0 1px var(--primary); }
`;
const kFilters: ReadonlyArray<TAlarmFilter> = ["All", "Armed", "Done", "Missed"];
const kFilterLabels: ReadonlyArray<string> = ["전체", "예약", "완료", "지나감"];
const kButtonLabels: ReadonlyArray<string> = ["확인만", "예 / 아니오"];
const kNewGroupLabel = "(새 그룹)";
const kClosedStates: ReadonlyArray<string> = ["Fired", "Missed", "Canceled"];

type TFormOutcome =
	| { Ok: true; Spec: IAlarmSpec }
	| { Ok: false; Error: string };

interface IRowHandle
{
	Id: string;
	Root: StackPanel;
	Remain: TextBlock;
}

interface IHeadCell
{
	Text: string;
	Width: number;
}

// 목록 맨 위 컬럼명 행. 폭은 본문 행이 쓰는 컬럼 상수를 그대로 참조한다 —
// 숫자를 다시 적으면 한쪽만 고쳤을 때 조용히 어긋난다. Width 0은 자동(남는 폭)이다.
const kArmedHead: ReadonlyArray<IHeadCell> = [
	{ Text: "", Width: kColDot },
	{ Text: "시각", Width: kColClock },
	{ Text: "제목", Width: kColTitle },
	{ Text: "상태", Width: kColState },
	{ Text: "남은 시간", Width: kColRemain },
	{ Text: "동작", Width: 0 },
];
const kHistoryHead: ReadonlyArray<IHeadCell> = [
	{ Text: "", Width: kColDot },
	{ Text: "시각", Width: kColClock },
	{ Text: "제목", Width: kColTitle },
	{ Text: "결과", Width: kColState },
	{ Text: "경과", Width: kColRemain },
	{ Text: "동작", Width: 0 },
];

//////////////////////////////////////////////////////////////////////////////////////
// 스키마 모양인지 본다. 설정 스키마를 못 읽었으면 PropertyGrid를 건너뛴다.
// @param _value: 검사 대상
function AsSchema(_value: unknown): IJsonSchemaNode | null
{
	if (typeof _value !== "object" || _value === null || Array.isArray(_value))
		return null;
	const record = _value as IJsonSchemaNode;
	return typeof record.properties === "object" ? record : null;
}

export class MainControl extends UserControl
{
	// ==================== 정적 ====================
	private static s_engine_: AlarmEngine | null = null;
	private static s_options_: IAlarmOptions | null = null;
	private static s_ports_: IAlarmViewPorts | null = null;

	// ==================== 멤버 ====================
	private data_!: DataList;
	private armedList_: VirtualList | null = null;
	private historyList_: VirtualList | null = null;
	private stopTick_: (() => void) | null = null;
	private armedRows_: IArmedAlarm[] = [];
	private historyRows_: IArmedAlarm[] = [];
	private groups_: IAlarmGroup[] = [];
	private readonly live_ = new Map<string, IRowHandle>();
	private filter_: TAlarmFilter = "All";
	private selectedAlarmId_ = "";
	// 수정 중인 예약 Id. 비어 있으면 추가 오버레이는 "새 알람" 모드다.
	private editingId_ = "";
	private signature_ = "";
	// 첫 Reload에서 반드시 한 번 채워지도록 그룹이 없을 때의 서명("")과 다른 값으로 시작한다.
	private groupSignature_ = "?";

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진·설정 getter·화면 창구를 1회 주입한다. Index OnActivate에서만 부른다.
	// 엔진을 새로 만들지 않는다 — 복원 판정이 두 번 돌면 알람이 두 번 울린다.
	// @param _engine: Index가 만든 엔진 인스턴스
	// @param _options: 설정 getter 묶음
	// @param _ports: 공용 틱·미리보기·설정 창구
	public static Configure(_engine: AlarmEngine, _options: IAlarmOptions, _ports: IAlarmViewPorts): void
	{
		MainControl.s_engine_ = _engine;
		MainControl.s_options_ = _options;
		MainControl.s_ports_ = _ports;
	}

	// ==================== 확장점 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨트롤을 묶고 목록을 채운 뒤 공용 틱에 화면 갱신을 얹는다.
	// @param _data: 바인딩 소스
	protected override OnInit(_data: DataList): void
	{
		this.data_ = _data;
		this.Element.classList.add(kViewClass);
		MainControl.EnsureStyle();
		this.BindHeader();
		this.BindGroups();
		this.BindToolbar();
		this.BindOverlays();
		this.BindLists();
		this.Reload(Date.now(), true);
		const ports = MainControl.s_ports_;
		if (ports !== null)
		{
			// WhenVisible: true — 이 화면이 실제로 보일 때만 돈다. 엔진 tick은 Index가 따로 건다.
			this.stopTick_ = ports.Tick((_now: number) => { this.Reload(_now, false); });
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 공용 틱 구독을 끊는다. 컨텍스트도 알아서 걷어가지만 명시적으로 끊는다.
	protected override OnDispose(): void
	{
		this.stopTick_?.();
		this.stopTick_ = null;
		this.live_.clear();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 상단 헤더 버튼을 묶는다.
	private BindHeader(): void
	{
		this.FindName(Button, "btn_next_snooze")?.Click.Add(() =>
		{
			const next = this.NextAlarm();
			if (next === null)
				this.SetState("미룰 예약이 없습니다");
			else
				this.Snooze(next, kSnoozeSec);
		});
		this.FindName(Button, "btn_next_cancel")?.Click.Add(() =>
		{
			const next = this.NextAlarm();
			if (next === null)
				this.SetState("취소할 예약이 없습니다");
			else
				this.CancelOne(next);
		});
		this.FindName(Button, "btn_settings")?.Click.Add(() => { this.OpenSettings(); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 왼쪽 그룹 패널을 묶는다.
	private BindGroups(): void
	{
		this.FindName(ListBox, "lst_groups")?.SelectionChanged.Add(() => { this.SetState(this.SelectedGroupName()); });
		this.FindName(Button, "btn_group_arm")?.Click.Add(() => { this.ArmSelectedGroup(); });
		this.FindName(Button, "btn_group_delete")?.Click.Add(() => { this.DeleteSelectedGroup(); });
		this.FindName(Button, "btn_group_new")?.Click.Add(() =>
		{
			this.OpenAdd(null);
			this.SelectGroupCombo(kNewGroupLabel);
			this.SetState("새 그룹에 담을 알람을 채우고 [그룹에 저장]을 누르세요");
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록 위 도구 모음을 묶는다.
	private BindToolbar(): void
	{
		const filter = this.FindName(ComboBox, "cmb_filter");
		if (filter !== null)
		{
			filter.SetItems([...kFilterLabels]);
			filter.SelectedIndex = 0;
			filter.SelectionChanged.Add(() =>
			{
				const idx = Math.max(0, filter.SelectedIndex);
				this.filter_ = kFilters[idx] ?? "All";
				this.Reload(Date.now(), true);
			});
		}
		this.FindName(Button, "btn_cancel_sel")?.Click.Add(() => { this.CancelSelected(); });
		this.FindName(Button, "btn_clear_done")?.Click.Add(() => { this.ClearDone(); });
		this.FindName(Button, "btn_test_fire")?.Click.Add(() => { this.PreviewFromForm(); });
		this.FindName(Button, "btn_add")?.Click.Add(() => { this.OpenAdd(null); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 오버레이 2종을 묶는다. 딤 클릭 닫기·ESC 닫기는 자동이 아니라 직접 건다.
	private BindOverlays(): void
	{
		const add = this.FindName(Grid, "ovl_add");
		add?.PointerDown.Add((_s, _a) =>
		{
			// 딤 자체를 눌렀을 때만 닫는다. 패널 안쪽 클릭은 Source가 달라 걸리지 않는다.
			if (_a.Source === add)
				this.CloseAdd();
		});
		const settings = this.FindName(Grid, "ovl_settings");
		settings?.PointerDown.Add((_s, _a) =>
		{
			if (_a.Source === settings)
				this.CloseSettings();
		});
		this.PreviewKeyDown.Add((_s, _a) =>
		{
			const isOpen = this.data_.Get("isAddOpen") === true || this.data_.Get("isSettingsOpen") === true;
			if (_a.Key === "Escape")
			{
				if (this.data_.Get("isAddOpen") === true)
				{
					this.CloseAdd();
					_a.Handled = true;
				}
				else if (this.data_.Get("isSettingsOpen") === true)
				{
					this.CloseSettings();
					_a.Handled = true;
				}
				return;
			}
			// Delete로 고른 예약을 지운다. 오버레이가 열려 있거나 글자를 치는 중이면 가로채지 않는다.
			if (_a.Key !== "Delete" || isOpen || _a.Source instanceof TextBox)
				return;
			if (this.DeleteSelected())
				_a.Handled = true;
		});
		this.FindName(Button, "btn_add_close")?.Click.Add(() => { this.CloseAdd(); });
		this.FindName(Button, "btn_settings_close")?.Click.Add(() => { this.CloseSettings(); });
		// 구독은 여기서 1회만. 열 때마다 걸면 설정 1회 변경에 여러 번 쓰인다.
		this.FindName(PropertyGrid, "grid_settings")?.ValueChanged.Add((_args: { Path: string; Value: unknown }) =>
		{
			MainControl.s_ports_?.SettingsSet(_args.Path, _args.Value);
		});
		this.FindName(Button, "btn_arm_one")?.Click.Add(() => { this.ArmFromForm(); });
		this.FindName(Button, "btn_save_group")?.Click.Add(() => { this.SaveFormToGroup(); });
		this.FindName(RadioButton, "radio_after")?.Checked.Add(() => { this.SetData("isAt", false); });
		this.FindName(RadioButton, "radio_at")?.Checked.Add(() => { this.SetData("isAt", true); });
		const button = this.FindName(ComboBox, "cmb_button");
		if (button !== null)
		{
			button.SetItems([...kButtonLabels]);
			button.SelectedIndex = 0;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// VirtualList 2개에 템플릿을 꽂고 컬럼명 헤더를 채운다. 코드 주입이 필수인 컨트롤이다.
	private BindLists(): void
	{
		this.armedList_ = this.FindName(VirtualList, "lst_armed");
		this.historyList_ = this.FindName(VirtualList, "lst_history");
		this.BuildHead("pnl_armed_head", kArmedHead);
		this.BuildHead("pnl_history_head", kHistoryHead);
		const armed = this.armedList_;
		if (armed !== null)
		{
			this.PrepareVirtual(armed);
			armed.ItemTemplate = (_idx: number): UIElement => this.MakeRow(this.armedRows_[_idx], armed, kArmedKey);
		}
		const history = this.historyList_;
		if (history !== null)
		{
			this.PrepareVirtual(history);
			history.ItemTemplate = (_idx: number): UIElement => this.MakeRow(this.historyRows_[_idx], history, kHistoryKey);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 컬럼명 헤더 한 줄을 채운다. 헤더는 VirtualList 바깥(DockPanel 위쪽)에 있어 스크롤에 밀리지 않는다.
	// 칸 폭은 본문 행과 같은 상수라 스크롤 위치와 무관하게 컬럼 x가 일치한다.
	// @param _name: XML에 비워 둔 헤더 StackPanel 이름
	// @param _cells: 칸 정의(폭 0은 자동)
	private BuildHead(_name: string, _cells: ReadonlyArray<IHeadCell>): void
	{
		const head = this.FindName(StackPanel, _name);
		if (head === null)
			return;
		head.Element.classList.add(kHeadClass);
		for (const cell of _cells)
		{
			const text = new TextBlock();
			text.Text = cell.Text;
			if (cell.Width > 0)
				text.Width = cell.Width;
			head.AddChild(text);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 높이를 고정하고 목록에 포커스를 받을 수 있게 한다. 나머지 배치는 주입한 보정 CSS가 맡는다.
	// 행은 VirtualList의 논리 자식이 아니라(DOM에만 붙는다) 행에 포커스를 줘도 키가 화면까지
	// 올라오지 않는다. 목록 자체가 포커스를 받아야 Delete가 이 UserControl까지 라우팅된다.
	// @param _list: 대상 목록
	private PrepareVirtual(_list: VirtualList): void
	{
		_list.SetValue(VirtualList.ItemHeightProperty, kRowHeight);
		_list.Focusable = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 1개를 만든다. 남은 시간 칸만 tick에서 다시 쓰므로 handle로 붙잡아 둔다.
	// 시각·제목·상태·남은 시간은 고정 폭이라 행이 바뀌어도 컬럼 x가 흔들리지 않는다.
	// @param _alarm: 예약 인스턴스(범위를 벗어나면 undefined)
	// @param _list: 이 행이 속한 목록(선택 시 포커스를 받을 대상)
	// @param _listKey: 행 캐시를 목록별로 가르는 키
	private MakeRow(_alarm: IArmedAlarm | undefined, _list: VirtualList, _listKey: string): UIElement
	{
		const row = new StackPanel();
		row.Orientation = Orientation.Horizontal;
		row.Spacing = 8;
		row.Element.style.position = "absolute";
		row.Element.style.left = "0";
		row.Element.style.right = "0";
		row.Element.style.alignItems = "center";
		row.Element.style.padding = "0 6px";
		row.Element.style.borderRadius = "4px";
		if (_alarm === undefined)
			return row;
		row.Element.classList.add(kRowClass);
		const engine = MainControl.s_engine_;
		const now = Date.now();
		const dot = new StatusDot();
		dot.Status = MainControl.DotOf(_alarm);
		const clock = new TextBlock();
		clock.Text = AlarmFormat.Clock(_alarm.DueAtMs, now);
		clock.Width = kColClock;
		const title = new TextBlock();
		title.Text = _alarm.Spec.Title.length > 0 ? _alarm.Spec.Title : _alarm.SpecId;
		title.ToolTip = title.Text;
		title.Width = kColTitle;
		title.Element.style.overflow = "hidden";
		title.Element.style.whiteSpace = "nowrap";
		title.Element.style.textOverflow = "ellipsis";
		const badge = new Badge();
		badge.Text = AlarmFormat.StateText(_alarm);
		badge.SetValue(Badge.VariantProperty, AlarmFormat.StateVariant(_alarm));
		badge.Width = kColState;
		const remain = new TextBlock();
		remain.Text = this.RemainTextOf(_alarm, now);
		remain.Width = kColRemain;
		row.AddChild(dot);
		row.AddChild(clock);
		row.AddChild(title);
		row.AddChild(badge);
		row.AddChild(remain);
		if (_alarm.State === "Armed")
		{
			const snooze = new Button();
			snooze.Content = "+5";
			snooze.Variant = "Default";
			snooze.ToolTip = "예약 Id를 그대로 두고 5분 뒤로 민다";
			snooze.Click.Add(() => { this.Snooze(_alarm, kSnoozeSec); });
			const cancel = new Button();
			cancel.Content = "취소";
			cancel.Variant = "Default";
			cancel.Click.Add(() => { this.CancelOne(_alarm); });
			row.AddChild(snooze);
			row.AddChild(cancel);
		}
		else
		{
			const again = new Button();
			again.Content = "다시 예약";
			// Ghost는 배경이 없어 그냥 글자로 보인다. 행 안에 들어가는 버튼이라 Primary는 과하므로
			// 테두리+배경만 있는 Default로 둔다(같은 행의 +5·취소보다 한 단계 위, Primary보다 한 단계 아래).
			again.Variant = "Default";
			again.Click.Add(() => { this.ArmAgain(_alarm); });
			row.AddChild(again);
		}
		row.PointerDown.Add(() => { this.SelectRow(_alarm.Id, _list); });
		// 우클릭도 먼저 행을 고른다. 이 구독이 ContextMenu 설정보다 앞서야 메뉴가 뜨기 전에 선택이 끝난다.
		row.ContextMenuOpening.Add(() => { this.SelectRow(_alarm.Id, _list); });
		row.ContextMenu = this.MakeRowMenu(_alarm);
		// 선택 표시는 클래스 하나로 몬다. Delete 키·우클릭 메뉴가 보는 selectedAlarmId_와 같은 값이다.
		row.Element.classList.toggle(kSelectedClass, _alarm.Id === this.selectedAlarmId_);
		if (engine !== null && _alarm.State === "Armed" && engine.IsUrgent(_alarm))
			remain.Element.style.color = "var(--error)";
		this.live_.set(MainControl.RowKey(_listKey, _alarm.Id), { Id: _alarm.Id, Root: row, Remain: remain });
		return row;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 우클릭 메뉴를 만든다. XML로는 선언할 수 없어 코드로만 만든다.
	// 항목은 상태에 따라 다르다 — 예약 중이면 수정·미루기·취소, 끝났으면 다시 예약·기록 삭제.
	// @param _alarm: 예약 인스턴스
	private MakeRowMenu(_alarm: IArmedAlarm): ContextMenu
	{
		const menu = new ContextMenu();
		if (_alarm.State === "Armed")
		{
			menu.AddItem(MainControl.MakeMenuItem("수정", "", () => { this.EditAlarm(_alarm.Id); }));
			menu.AddItem(MainControl.MakeMenuItem("5분 뒤로 미루기", "", () => { this.Snooze(_alarm, kSnoozeSec); }));
			menu.AddItem(MainControl.MakeMenuItem("1시간 뒤로 미루기", "", () => { this.Snooze(_alarm, kHourSec); }));
			menu.AddItem(MainControl.MakeMenuItem("지금 미리보기", "", () => { this.PreviewSpec(_alarm); }));
			menu.AddItem(MainControl.MakeMenuItem("삭제(예약 취소)", "Del", () => { this.CancelOne(_alarm); }));
			return menu;
		}
		menu.AddItem(MainControl.MakeMenuItem("같은 내용으로 다시 예약", "", () => { this.ArmAgain(_alarm); }));
		menu.AddItem(MainControl.MakeMenuItem("지금 미리보기", "", () => { this.PreviewSpec(_alarm); }));
		menu.AddItem(MainControl.MakeMenuItem("삭제(기록에서 지움)", "Del", () => { this.RemoveFromHistory(_alarm); }));
		return menu;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진 상태를 읽어 목록·헤더를 맞춘다. 상태 서명이 그대로면 남은 시간만 다시 쓴다.
	// @param _nowMs: 기준 시각
	// @param _force: 서명과 무관하게 다시 그릴지
	private Reload(_nowMs: number, _force: boolean): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const groupSignature = engine.Store.ListGroups().map((_g) => `${_g.Id}:${_g.Specs.length}`).join(",");
		if (groupSignature !== this.groupSignature_)
		{
			this.groupSignature_ = groupSignature;
			this.RefreshGroups();
		}
		const all = engine.Store.ListArmed();
		const signature = `${this.filter_}|${all.map((_a) => `${_a.Id}:${_a.State}:${_a.Result}`).join(",")}`;
		if (_force || signature !== this.signature_)
		{
			this.signature_ = signature;
			this.Rebuild(all);
		}
		this.RefreshRemain(_nowMs);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록 두 개와 개수 표시를 다시 만든다. 행 캐시는 통째로 버린다.
	// @param _all: 저장소 전체 목록(마감순)
	private Rebuild(_all: IArmedAlarm[]): void
	{
		const armed = _all.filter((_a) => _a.State === "Armed");
		const done = _all.filter((_a) => _a.State === "Fired");
		const missed = _all.filter((_a) => _a.State === "Missed");
		this.armedRows_ = _all.filter((_a) => this.Passes(_a));
		this.historyRows_ = _all.filter((_a) => kClosedStates.includes(_a.State)).reverse();
		this.data_.Update({ armedCount: armed.length, doneCount: done.length, missedCount: missed.length });
		this.live_.clear();
		MainControl.ResetList(this.armedList_, this.armedRows_.length);
		MainControl.ResetList(this.historyList_, this.historyRows_.length);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 남은 시간만 다시 쓴다. 헤더 1줄 + 화면에 살아 있는 행만 건드린다.
	// @param _nowMs: 기준 시각
	private RefreshRemain(_nowMs: number): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const next = this.NextAlarm();
		const dot = this.FindName(StatusDot, "dot_next");
		const badge = this.FindName(Badge, "badge_next");
		// hasNext가 false면 XML 바인딩이 "다음 알람" 라벨·남은 시간·+5분·취소를 통째로 감춘다.
		this.SetData("hasNext", next !== null);
		if (next === null)
		{
			this.SetData("nextTitle", "다음 알람이 없습니다.");
			this.SetData("nextText", "");
			if (dot !== null)
				dot.Status = DotStatus.Idle;
			if (badge !== null)
				badge.Visibility = Visibility.Collapsed;
		}
		else
		{
			const urgent = engine.IsUrgent(next);
			this.SetData("nextTitle", MainControl.TitleOf(next));
			this.SetData("nextText", `예정 ${AlarmFormat.Clock(next.DueAtMs, _nowMs)} · ${AlarmFormat.Remain(engine.RemainingMs(next))}`);
			if (dot !== null)
				dot.Status = urgent ? DotStatus.Warn : DotStatus.Ok;
			if (badge !== null)
				badge.Visibility = urgent ? Visibility.Visible : Visibility.Collapsed;
		}
		for (const [key, handle] of [...this.live_])
		{
			// isConnected로 보면 안 된다 — OnInit 시점에는 화면이 아직 문서에 붙기 전이라
			// 멀쩡한 행까지 전부 지워지고, 그 뒤로는 남은 시간이 영영 멈춘다.
			// VirtualList가 행을 버릴 때 Element.remove()를 하므로 부모 유무로 판정한다.
			if (handle.Root.Element.parentElement === null)
			{
				this.live_.delete(key);
				continue;
			}
			const alarm = engine.Store.FindArmed(handle.Id);
			if (alarm === null)
				continue;
			const text = this.RemainTextOf(alarm, _nowMs);
			if (handle.Remain.Text !== text)
				handle.Remain.Text = text;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태별 남은 시간 문구를 만든다. 예약이면 카운트다운, 나머지는 경과·결과.
	// @param _alarm: 예약 인스턴스
	// @param _nowMs: 기준 시각
	private RemainTextOf(_alarm: IArmedAlarm, _nowMs: number): string
	{
		const engine = MainControl.s_engine_;
		if (_alarm.State === "Armed")
			return AlarmFormat.Remain(engine === null ? _alarm.DueAtMs - _nowMs : engine.RemainingMs(_alarm));
		if (_alarm.State === "Missed")
			return AlarmFormat.Elapsed(_nowMs - _alarm.DueAtMs);
		if (_alarm.State === "Canceled")
			return "취소됨";
		return AlarmFormat.Elapsed(_nowMs - Math.max(_alarm.FiredAtMs, _alarm.DueAtMs));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 필터를 통과하는지 본다.
	// @param _alarm: 예약 인스턴스
	private Passes(_alarm: IArmedAlarm): boolean
	{
		switch (this.filter_)
		{
			case "Armed": return _alarm.State === "Armed";
			case "Done": return _alarm.State === "Fired";
			case "Missed": return _alarm.State === "Missed";
			default: return true;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 가장 먼저 울릴 예약을 구한다. 없으면 null.
	private NextAlarm(): IArmedAlarm | null
	{
		return MainControl.s_engine_?.PendingList()[0] ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행을 고른다. 목록을 통째로 다시 만들지 않고 살아 있는 행의 배경만 갈아 끼운다
	// (다시 만들면 방금 누른 행이 사라져 우클릭 메뉴가 뜨기도 전에 주인을 잃는다).
	// @param _id: 예약 인스턴스 Id
	// @param _list: 포커스를 받을 목록
	private SelectRow(_id: string, _list: VirtualList): void
	{
		this.selectedAlarmId_ = _id;
		this.ApplySelection();
		// 브라우저 기본 포커스 이동(mousedown)이 끝난 뒤에 목록으로 되돌린다. 그래야 Delete가 먹는다.
		requestAnimationFrame(() => { _list.Focus(); });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고른 행에만 선택 클래스를 남긴다. 행을 다시 만들지 않는 가벼운 갱신 경로다.
	// 같은 예약이 [예약 목록]과 [기록]에 동시에 떠 있으면 두 행 모두 칠해진다(같은 선택 상태다).
	private ApplySelection(): void
	{
		for (const handle of this.live_.values())
			handle.Root.Element.classList.toggle(kSelectedClass, handle.Id === this.selectedAlarmId_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 1건을 취소한다.
	// @param _alarm: 예약 인스턴스
	private CancelOne(_alarm: IArmedAlarm): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		this.SetState(engine.Cancel(_alarm.Id) ? `취소: ${_alarm.Spec.Title}` : "이미 끝난 알람입니다");
		this.Reload(Date.now(), true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고른 항목을 지운다. 예약 중이면 취소, 끝난 기록이면 목록에서 아예 뺀다.
	// Delete 키와 우클릭 [삭제]가 함께 쓴다. 지웠으면 true.
	private DeleteSelected(): boolean
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return false;
		const alarm = this.selectedAlarmId_.length > 0 ? engine.Store.FindArmed(this.selectedAlarmId_) : null;
		if (alarm === null)
		{
			this.SetState("지울 항목을 목록에서 고르세요");
			return false;
		}
		if (alarm.State === "Armed")
			this.CancelOne(alarm);
		else
			this.RemoveFromHistory(alarm);
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 끝난 1건을 기록에서 지운다. 예약 중인 건은 건드리지 않는다.
	// @param _alarm: 예약 인스턴스
	private RemoveFromHistory(_alarm: IArmedAlarm): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		if (_alarm.State === "Armed")
		{
			this.SetState("예약 중인 알람은 먼저 취소해야 지울 수 있습니다");
			return;
		}
		engine.Store.RemoveArmed(_alarm.Id);
		if (this.selectedAlarmId_ === _alarm.Id)
			this.selectedAlarmId_ = "";
		this.SetState(`기록 삭제: ${MainControl.TitleOf(_alarm)}`);
		this.Reload(Date.now(), true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 스펙 그대로 알림만 한 번 띄운다. 예약은 건드리지 않는다.
	// @param _alarm: 예약 인스턴스
	private PreviewSpec(_alarm: IArmedAlarm): void
	{
		MainControl.s_ports_?.Preview(_alarm.Spec);
		this.SetState(`미리보기: ${MainControl.TitleOf(_alarm)}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고른 행을 취소한다. 고른 게 없으면 알려만 준다.
	private CancelSelected(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const alarm = this.selectedAlarmId_.length > 0 ? engine.Store.FindArmed(this.selectedAlarmId_) : null;
		if (alarm === null || alarm.State !== "Armed")
		{
			this.SetState("취소할 예약을 목록에서 고르세요");
			return;
		}
		this.CancelOne(alarm);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약을 뒤로 민다. 엔진 Postpone은 Id를 그대로 두고 마감 시각만 옮기므로
	// 예전처럼 취소 후 재예약해서 Id가 바뀌는 일이 없다(확인 절차도 필요 없다).
	// @param _alarm: 예약 인스턴스
	// @param _seconds: 미룰 초
	private Snooze(_alarm: IArmedAlarm, _seconds: number): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const outcome = engine.Postpone(_alarm.Id, _seconds);
		if (!outcome.Ok)
		{
			this.SetState(outcome.Error);
			return;
		}
		const now = Date.now();
		this.SetState(`${MainControl.MinuteText(_seconds)} 미룸: ${MainControl.TitleOf(_alarm)} · 예정 ${AlarmFormat.Clock(outcome.Alarm.DueAtMs, now)}`);
		this.Reload(now, true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 끝난 알람을 같은 스펙으로 다시 예약한다. 절대 알람은 다음 날로 넘어가게 둔다.
	// @param _alarm: 예약 인스턴스
	private ArmAgain(_alarm: IArmedAlarm): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const spec: IAlarmSpec = { ..._alarm.Spec, Id: engine.Store.NewId("spec") };
		if (spec.Kind === "At")
			spec.RollToNextDay = true;
		const outcome = engine.ArmSpec(spec, _alarm.GroupName);
		this.SetState(outcome.Ok ? `다시 예약: ${spec.Title}` : outcome.Error);
		this.Reload(Date.now(), true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 완료·취소·지나감 기록을 전부 지운다. 예약 중인 건은 남는다.
	private ClearDone(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const removed = engine.Store.PruneHistory(Date.now(), 0);
		this.SetState(`기록 ${removed}건 정리`);
		this.Reload(Date.now(), true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼 내용 그대로 알림만 한 번 띄운다. 예약하지 않는다.
	private PreviewFromForm(): void
	{
		const ports = MainControl.s_ports_;
		const outcome = this.ReadForm();
		if (ports === null)
			return;
		if (outcome.Ok)
		{
			ports.Preview(outcome.Spec);
			this.SetState("미리보기 알림을 띄웠습니다");
			return;
		}
		const options = MainControl.s_options_;
		if (options === null)
			return;
		ports.Preview(SpecFactory.After("preview", 1, "미리보기", "이렇게 보입니다", options));
		this.SetState("미리보기 알림을 띄웠습니다");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼 내용으로 1건 예약(수정 모드면 갱신)하고 오버레이를 닫는다.
	// 실패하면 상태줄만 바꾸지 않고 메시지 박스로 사유를 알린다 — 조용히 실패하면 예약된 줄 안다.
	private ArmFromForm(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const editing = this.editingId_;
		const head = editing.length > 0 ? "알람을 수정할 수 없습니다" : "새 알람을 예약할 수 없습니다";
		const outcome = this.ReadForm();
		if (!outcome.Ok)
		{
			this.Reject(head, outcome.Error);
			return;
		}
		const armed = editing.length > 0 ? engine.Reschedule(editing, outcome.Spec) : engine.ArmSpec(outcome.Spec, "");
		if (!armed.Ok)
		{
			this.Reject(head, MainControl.ArmErrorText(armed.Error));
			return;
		}
		this.SetState(`${editing.length > 0 ? "수정" : "예약"}: ${outcome.Spec.Title} · 예정 ${AlarmFormat.Clock(armed.Alarm.DueAtMs, Date.now())}`);
		this.CloseAdd();
		this.Reload(Date.now(), true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 1건을 수정 모드로 연다. 값은 저장된 스펙과 실제 마감 시각에서 되읽는다.
	// @param _id: 예약 인스턴스 Id
	private EditAlarm(_id: string): void
	{
		const engine = MainControl.s_engine_;
		const alarm = engine === null ? null : engine.Store.FindArmed(_id);
		if (alarm === null || alarm.State !== "Armed")
		{
			this.Reject("알람을 수정할 수 없습니다", "이미 울렸거나 취소된 알람입니다. 수정은 예약 중인 알람만 됩니다.");
			return;
		}
		this.OpenAdd(alarm);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 입력을 거부하고 사유를 알린다. 상태줄에도 같은 문구를 남긴다.
	// @param _head: 메시지 박스 제목
	// @param _reason: 무엇이 잘못됐는지
	private Reject(_head: string, _reason: string): void
	{
		this.SetState(_reason);
		MainControl.s_ports_?.Alert(_head, _reason);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼 내용을 그룹에 담아 저장한다. 고른 그룹이 없거나 (새 그룹)이면 제목으로 새로 만든다.
	private SaveFormToGroup(): void
	{
		const engine = MainControl.s_engine_;
		const outcome = this.ReadForm();
		if (engine === null)
			return;
		if (!outcome.Ok)
		{
			this.Reject("그룹에 저장할 수 없습니다", outcome.Error);
			return;
		}
		const picked = this.SelectedComboText("cmb_group");
		const exist = picked.length > 0 && picked !== kNewGroupLabel ? engine.Store.FindGroupByName(picked) : null;
		const name = exist === null ? outcome.Spec.Title : exist.Name;
		const specs = exist === null ? [outcome.Spec] : [...exist.Specs, outcome.Spec];
		const id = exist === null ? engine.Store.NewId("group") : exist.Id;
		engine.Store.SaveGroup({ Id: id, Name: name, Description: "", Specs: specs });
		this.RefreshGroups();
		this.SetState(`그룹 저장: ${name} (${specs.length}건)`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 왼쪽 목록에서 고른 그룹을 통째로 예약한다.
	private ArmSelectedGroup(): void
	{
		const engine = MainControl.s_engine_;
		const group = this.SelectedGroup();
		if (engine === null)
			return;
		if (group === null)
		{
			this.SetState("예약할 그룹을 고르세요");
			return;
		}
		const report = engine.ArmGroup(group);
		this.SetState(report.Errors.length > 0
			? `${group.Name}: ${report.Armed.length}건 예약, ${report.Errors.length}건 실패`
			: `${group.Name}: ${report.Armed.length}건 예약`);
		this.Reload(Date.now(), true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고른 그룹을 지운다. 이미 예약된 알람은 스냅샷이라 그대로 울린다.
	private DeleteSelectedGroup(): void
	{
		const engine = MainControl.s_engine_;
		const group = this.SelectedGroup();
		if (engine === null)
			return;
		if (group === null)
		{
			this.SetState("지울 그룹을 고르세요");
			return;
		}
		engine.Store.RemoveGroup(group.Id);
		this.RefreshGroups();
		this.SetState(`그룹 삭제: ${group.Name}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 목록과 그룹 콤보를 다시 채운다.
	private RefreshGroups(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		this.groups_ = engine.Store.ListGroups();
		const labels = this.groups_.map((_g) => `${_g.Name} (${_g.Specs.length})`);
		const list = this.FindName(ListBox, "lst_groups");
		if (list !== null)
		{
			const keep = list.SelectedIndex;
			list.SetItems(labels);
			if (keep >= 0 && keep < labels.length)
				list.SelectedIndex = keep;
		}
		const combo = this.FindName(ComboBox, "cmb_group");
		if (combo !== null)
		{
			combo.SetItems([kNewGroupLabel, ...this.groups_.map((_g) => _g.Name)]);
			combo.SelectedIndex = 0;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 그룹 콤보에서 이름을 고른다. 없으면 첫 항목((새 그룹))으로 둔다.
	// @param _name: 고를 이름
	private SelectGroupCombo(_name: string): void
	{
		const combo = this.FindName(ComboBox, "cmb_group");
		if (combo === null)
			return;
		const idx = [kNewGroupLabel, ...this.groups_.map((_g) => _g.Name)].indexOf(_name);
		combo.SelectedIndex = idx < 0 ? 0 : idx;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 왼쪽 목록에서 고른 그룹을 구한다. 없으면 null.
	private SelectedGroup(): IAlarmGroup | null
	{
		const idx = this.FindName(ListBox, "lst_groups")?.SelectedIndex ?? -1;
		return idx >= 0 ? this.groups_[idx] ?? null : null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 고른 그룹 이름을 상태줄 문구로 만든다.
	private SelectedGroupName(): string
	{
		const group = this.SelectedGroup();
		return group === null ? "대기" : `${group.Name} · ${group.Specs.length}건`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 콤보에서 고른 문자열을 구한다. 고른 게 없으면 빈 문자열.
	// @param _name: 콤보 이름
	private SelectedComboText(_name: string): string
	{
		const item = this.FindName(ComboBox, _name)?.SelectedItem;
		return typeof item === "string" ? item : "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 추가 폼을 읽어 스펙으로 굳힌다. 입력이 모자라면 무엇이 왜 잘못됐는지 그대로 돌려준다.
	// "이미 지난 시각"은 여기서 보지 않는다 — 그룹 저장에는 지난 시각도 정상 입력이라
	// 실제로 예약을 거는 쪽(엔진)에서만 걸러야 한다.
	private ReadForm(): TFormOutcome
	{
		const engine = MainControl.s_engine_;
		const options = MainControl.s_options_;
		if (engine === null || options === null)
			return { Ok: false, Error: "엔진이 없습니다" };
		const title = this.TextOf("txt_title");
		if (title.length === 0)
			return { Ok: false, Error: "제목이 비어 있습니다. 알람을 구분할 제목을 입력하세요. (예: 빌드 확인)" };
		const message = this.TextOf("txt_message");
		const id = engine.Store.NewId("spec");
		const isAt = this.data_.Get("isAt") === true;
		let spec: IAlarmSpec;
		if (isAt)
		{
			const time = this.TextOf("txt_at_time");
			const date = this.TextOf("txt_at_date");
			const bad = MainControl.CheckAtTime(date, time);
			if (bad !== "")
				return { Ok: false, Error: bad };
			const at = date.length > 0 ? `${date} ${time}` : time;
			spec = SpecFactory.At(id, at, title, message, this.CheckOf("chk_roll"), options);
		}
		else
		{
			const seconds = this.NumberOf("num_hour") * 3600 + this.NumberOf("num_min") * 60 + this.NumberOf("num_sec");
			if (seconds < 1)
				return { Ok: false, Error: "시·분·초가 모두 0입니다. <시간 뒤> 알람은 1초 이상이어야 합니다. (예: 0시간 5분 0초)" };
			spec = SpecFactory.After(id, seconds, title, message, options);
		}
		spec.KindUi = this.FindName(ComboBox, "cmb_button")?.SelectedIndex === 1 ? "yesno" : "ok";
		spec.DurationSec = this.NumberOf("num_duration");
		spec.Topmost = this.CheckOf("chk_topmost");
		spec.WithToast = this.CheckOf("chk_toast");
		return { Ok: true, Spec: spec };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 추가 오버레이를 연다. 포커스를 안으로 넣어 ESC가 먹게 한다.
	// @param _editing: 수정할 예약(새로 만들면 null)
	private OpenAdd(_editing: IArmedAlarm | null): void
	{
		this.editingId_ = _editing === null ? "" : _editing.Id;
		this.FillForm(_editing);
		const head = this.FindName(TextBlock, "txt_add_head");
		if (head !== null)
			head.Text = _editing === null ? "새 알람" : "알람 수정";
		const arm = this.FindName(Button, "btn_arm_one");
		if (arm !== null)
			arm.Content = _editing === null ? "예약" : "수정 저장";
		this.SetData("isSettingsOpen", false);
		this.SetData("isAddOpen", true);
		this.FocusLater(() => this.FindName(Button, "btn_add_close"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 추가 오버레이를 닫는다. 수정 모드도 함께 푼다.
	private CloseAdd(): void
	{
		this.editingId_ = "";
		this.SetData("isAddOpen", false);
		this.FocusLater(() => this.FindName(Button, "btn_add"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 폼을 채운다. null이면 기본값으로 비운다.
	// 수정일 때 시각은 스펙이 아니라 실제 마감 시각(DueAtMs)에서 되읽는다 — 미룬 알람은
	// 스펙의 OffsetSec·AtTime이 이미 옛날 값이라 그대로 보여주면 거짓말이 된다.
	// @param _editing: 수정할 예약(새로 만들면 null)
	private FillForm(_editing: IArmedAlarm | null): void
	{
		const options = MainControl.s_options_;
		const spec = _editing?.Spec ?? null;
		const isAt = spec !== null && spec.Kind === "At";
		this.SetText("txt_title", spec === null ? "" : spec.Title);
		this.SetText("txt_message", spec === null ? "" : spec.Message);
		const radio = this.FindName(RadioButton, isAt ? "radio_at" : "radio_after");
		if (radio !== null)
			radio.IsChecked = true;
		this.SetData("isAt", isAt);
		if (_editing !== null && isAt)
		{
			this.SetText("txt_at_date", AlarmFormat.DateInput(_editing.DueAtMs));
			this.SetText("txt_at_time", AlarmFormat.TimeInput(_editing.DueAtMs));
		}
		else
		{
			this.SetText("txt_at_date", "");
			this.SetText("txt_at_time", "");
		}
		const remainSec = _editing === null || isAt ? -1 : Math.max(0, Math.round((_editing.DueAtMs - Date.now()) / 1000));
		this.SetNumber("num_hour", remainSec < 0 ? 0 : Math.floor(remainSec / 3600));
		this.SetNumber("num_min", remainSec < 0 ? 5 : Math.floor((remainSec % 3600) / 60));
		this.SetNumber("num_sec", remainSec < 0 ? 0 : remainSec % 60);
		this.SetCheck("chk_roll", spec !== null && spec.RollToNextDay);
		this.SetNumber("num_duration", spec === null ? Math.max(0, options?.DefaultDurationSec() ?? 0) : spec.DurationSec);
		this.SetCheck("chk_topmost", spec === null ? options?.DefaultTopmost() ?? true : spec.Topmost);
		this.SetCheck("chk_toast", spec !== null && spec.WithToast);
		const button = this.FindName(ComboBox, "cmb_button");
		if (button !== null)
			button.SelectedIndex = spec !== null && spec.KindUi === "yesno" ? 1 : 0;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 오버레이를 연다. 스키마를 못 읽었으면 PropertyGrid는 비워 둔다.
	private OpenSettings(): void
	{
		const ports = MainControl.s_ports_;
		const grid = this.FindName(PropertyGrid, "grid_settings");
		if (ports !== null && grid !== null)
		{
			const schema = AsSchema(ports.SettingsSchema());
			if (schema === null)
				this.SetState("설정 스키마를 읽지 못했습니다");
			else
				grid.SetSchema(schema, ports.SettingsValues());
		}
		this.SetData("isAddOpen", false);
		this.SetData("isSettingsOpen", true);
		this.FocusLater(() => this.FindName(Button, "btn_settings_close"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 설정 오버레이를 닫는다.
	private CloseSettings(): void
	{
		this.SetData("isSettingsOpen", false);
		this.FocusLater(() => this.FindName(Button, "btn_settings"));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 한 프레임 뒤에 포커스를 넣는다. Data 변경 → 바인딩 재평가가 microtask라서
	// 지금 당장은 오버레이가 아직 display:none이고, 숨은 요소에는 포커스가 들어가지 않는다.
	// 포커스가 이 화면 안에 있어야 KeyDown이 여기까지 라우팅돼 ESC 닫기가 먹는다.
	// @param _pick: 포커스를 줄 요소를 찾는 함수
	private FocusLater(_pick: () => UIElement | null): void
	{
		requestAnimationFrame(() =>
		{
			_pick()?.Focus();
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트 상자 값을 구한다. 없으면 빈 문자열.
	// @param _name: 컨트롤 이름
	private TextOf(_name: string): string
	{
		return this.FindName(TextBox, _name)?.Text.trim() ?? "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트 상자 값을 넣는다. 없으면 아무것도 하지 않는다.
	// @param _name: 컨트롤 이름
	// @param _text: 넣을 값
	private SetText(_name: string, _text: string): void
	{
		const box = this.FindName(TextBox, _name);
		if (box !== null)
			box.Text = _text;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 숫자 상자 값을 넣는다. 없으면 아무것도 하지 않는다.
	// @param _name: 컨트롤 이름
	// @param _value: 넣을 값
	private SetNumber(_name: string, _value: number): void
	{
		const box = this.FindName(NumericUpDown, _name);
		if (box !== null)
			box.Value = _value;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 체크 상자 값을 넣는다. 없으면 아무것도 하지 않는다.
	// @param _name: 컨트롤 이름
	// @param _on: 켤지
	private SetCheck(_name: string, _on: boolean): void
	{
		const box = this.FindName(CheckBox, _name);
		if (box !== null)
			box.IsChecked = _on;
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
	// 보정 CSS를 문서에 1회 주입한다. 이미 있으면 아무것도 하지 않는다.
	private static EnsureStyle(): void
	{
		if (document.getElementById(kStyleId) !== null)
			return;
		const style = document.createElement("style");
		style.id = kStyleId;
		style.textContent = kViewCss;
		document.head.append(style);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 행 캐시 키를 만든다. 필터가 [전체]면 끝난 예약 1건이 [예약 목록]과 [기록]에 동시에 뜬다.
	// 예약 Id만으로 키를 잡으면 나중에 만들어진 행이 앞 행을 덮어써, 선택 색이 다른 탭에만 칠해지고
	// 남은 시간 갱신도 한쪽에서 멈춘다. 목록 키를 섞어 두 행을 따로 붙잡는다.
	// @param _listKey: 목록 구분 키
	// @param _id: 예약 인스턴스 Id
	private static RowKey(_listKey: string, _id: string): string
	{
		return `${_listKey}:${_id}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록 개수를 다시 잡는다. 0으로 한 번 내려야 풀에 남은 옛 행이 버려진다.
	// @param _list: 대상 목록
	// @param _count: 새 개수
	private static ResetList(_list: VirtualList | null, _count: number): void
	{
		if (_list === null)
			return;
		_list.Count = 0;
		_list.Refresh();
		_list.Count = _count;
		_list.Refresh();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 메뉴 항목 1개를 만든다. ContextMenu는 XML로 선언할 수 없어 전부 코드로 만든다.
	// @param _header: 표시 문구
	// @param _gesture: 오른쪽에 붙일 단축키 문구(없으면 "")
	// @param _run: 눌렀을 때 할 일
	private static MakeMenuItem(_header: string, _gesture: string, _run: () => void): MenuItem
	{
		const item = new MenuItem();
		item.Header = _header;
		if (_gesture.length > 0)
			item.InputGestureText = _gesture;
		item.Click.Add(() => { _run(); });
		return item;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 날짜·시각 입력을 검사한다. 통과하면 "". 형식 오류는 어느 칸이 왜 틀렸는지 짚어 준다.
	// @param _date: 날짜 칸(비어도 된다)
	// @param _time: 시각 칸
	private static CheckAtTime(_date: string, _time: string): string
	{
		if (_time.length === 0)
			return "시각이 비어 있습니다. HH:mm 24시간 형식으로 입력하세요. (예: 22:12)";
		if (ParseAtTime(_time) === null)
			return `시각 "${_time}"은 형식이 잘못됐습니다. HH:mm 24시간 형식이어야 합니다. (예: 09:05, 22:12)`;
		if (_date.length > 0 && ParseAtTime(`${_date} ${_time}`) === null)
			return `날짜 "${_date}"는 형식이 잘못됐습니다. YYYY-MM-DD 형식이어야 합니다. (예: 2026-09-17)`;
		return "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진이 돌려준 예약 거부 사유를 사람이 바로 고칠 수 있는 문구로 늘린다.
	// @param _error: 엔진 사유
	private static ArmErrorText(_error: string): string
	{
		if (_error.startsWith("이미 지난 시각"))
			return `${_error} — 형식은 맞지만 지금보다 앞선 시각입니다. [지났으면 다음 날]을 켜거나 더 뒤 시각으로 바꾸세요.`;
		return _error;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 초를 "5분"·"1시간" 같은 문구로 만든다. 미룬 양을 알릴 때만 쓴다.
	// @param _seconds: 초
	private static MinuteText(_seconds: number): string
	{
		return _seconds >= kHourSec ? `${Math.round(_seconds / kHourSec)}시간` : `${Math.round(_seconds / 60)}분`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 표시용 제목을 구한다. 제목이 비어 있으면 스펙 Id로 대신한다.
	// @param _alarm: 예약 인스턴스
	private static TitleOf(_alarm: IArmedAlarm): string
	{
		return _alarm.Spec.Title.length > 0 ? _alarm.Spec.Title : _alarm.SpecId;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태에 맞는 점 색을 고른다.
	// @param _alarm: 예약 인스턴스
	private static DotOf(_alarm: IArmedAlarm): DotStatus
	{
		switch (_alarm.State)
		{
			case "Armed": return DotStatus.Ok;
			case "Missed": return DotStatus.Error;
			case "Fired": return DotStatus.Idle;
			default: return DotStatus.Warn;
		}
	}
}
