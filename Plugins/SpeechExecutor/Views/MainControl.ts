/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: SpeechExecutor 메인 화면. Home/API 탭, 우측 로그.
*/

import { UserControl, TextBox, Button, CheckBox, ListBox, Terminal, ContextMenu, MenuItem } from "@scouter/gui";
import type { DataList, UIElement } from "@scouter/gui";
import type { SpeechEngine, IEngineUi } from "../SpeechEngine";

export class MainControl extends UserControl
{
	// ==================== 정적 ====================
	private static s_engine_: SpeechEngine | null = null;
	private static s_current_: MainControl | null = null;
	private static s_setting_: boolean = false;
	private static readonly s_styleId_ = "speechexecutor-view-style";
	private static readonly s_viewClass_ = "speexec-view";
	private static readonly s_viewCss_ = `
.speexec-view .gui-tabcontrol { flex: 1 1 auto; min-height: 0; }
.speexec-view .gui-tabcontrol__content { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.speexec-view .gui-tabpage:not([hidden]) { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.speexec-view .gui-logview { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.speexec-view .gui-terminal { flex: 1 1 auto; min-height: 0; }
.speexec-view .gui-logview .gui-virtual { flex: 1 1 auto; min-height: 0; display: flex; }
.speexec-view .gui-logview .gui-virtual__viewport { flex: 1 1 auto; min-height: 0; width: 100%; overflow-y: auto; overflow-x: auto; }
@keyframes speexec-eq-bounce { from { height: 3px; } to { height: 12px; } }
.speexec-eq { display: none; align-items: center; align-self: center; vertical-align: middle; height: 14px; margin: 0 4px; }
.speexec-eq.on { display: inline-flex; }
.speexec-eq i { width: 3px; height: 3px; margin-right: 2px; background: #4EC9B0; align-self: center; animation: speexec-eq-bounce 0.35s ease-in-out infinite alternate; }
.speexec-eq i:nth-child(2) { animation-duration: 0.45s; animation-delay: 0.12s; }
.speexec-eq i:nth-child(3) { animation-duration: 0.3s; animation-delay: 0.24s; }
.speexec-eq i:nth-child(4) { animation-duration: 0.5s; animation-delay: 0.06s; }
.speexec-eq i:nth-child(5) { margin-right: 4px; animation-duration: 0.4s; animation-delay: 0.18s; }
.speexec-eq b { width: 8px; height: 8px; border-radius: 50%; background: #4EC9B0; }
`;

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진 싱크. Index에서 전달.
	public static get Sink(): IEngineUi
	{
		return {
			Log: (_level, _msg) => MainControl.s_current_?.UiLog(_level, _msg),
			Status: (_role, _conn, _stt, _hb) => MainControl.s_current_?.UiStatus(_role, _conn, _stt, _hb),
			Recognized: (_text) => MainControl.s_current_?.UiRecognized(_text),
			Partial: (_text) => MainControl.s_current_?.UiPartial(_text),
			Keys: (_provider) => MainControl.s_current_?.UiKeys(),
			Mappings: () => MainControl.s_current_?.UiMappings(),
			Peers: () => MainControl.s_current_?.UiPeers(),
			Source: (_text, _external) => MainControl.s_current_?.UiSource(_text, _external),
			Funcs: () => MainControl.s_current_?.UiFuncs(),
			Nickname: (_nick) => MainControl.s_current_?.UiNickname(_nick),
			SttButton: (_label) => MainControl.s_current_?.UiSttButton(_label),
			SttListening: (_on) => MainControl.s_current_?.UiSttListening(_on),
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 엔진을 주입한다. Index OnActivate에서 1회.
	// @param _engine: 엔진
	public static Configure(_engine: SpeechEngine): void
	{
		MainControl.s_engine_ = _engine;
	}

	// ==================== 멤버 ====================
	private data_!: DataList;
	private eqEl_: HTMLElement | null = null;
	private keyIds_: string[] = [];
	private mapSel_ = -1;
	private peerSel_ = -1;
	private keySel_ = -1;

	// ==================== 재정의 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨트롤을 묶는다.
	// @param _data: 바인딩 데이터
	protected override OnInit(_data: DataList): void
	{
		this.data_ = _data;
		MainControl.s_current_ = this;
		MainControl.EnsureStyle();
		this.Element.classList.add(MainControl.s_viewClass_);
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		// 저장된 체크 상태를 먼저 복원한다 (핸들러 연결 전이라 Click이 나가지 않는다).
		this.RequireName(CheckBox, "chk_multi").IsChecked = engine.AllowMulti();
		this.RequireName(CheckBox, "chk_block").IsChecked = engine.BlockTrigger();
		this.FindName(Button, "btn_listen")?.Click.Add(() =>
		{
			engine.SetHost(this.RequireName(TextBox, "txt_host").Text);
			engine.SetNickname(this.RequireName(TextBox, "txt_nick").Text);
			void engine.ListenAsync();
		});
		this.FindName(Button, "btn_connect")?.Click.Add(() =>
		{
			engine.SetHost(this.RequireName(TextBox, "txt_host").Text);
			engine.SetNickname(this.RequireName(TextBox, "txt_nick").Text);
			void engine.ConnectAsync();
		});
		this.FindName(Button, "btn_stop")?.Click.Add(() =>
		{
			engine.StopLink();
		});
		this.FindName(Button, "btn_stt")?.Click.Add(() =>
		{
			void engine.ToggleSttAsync();
		});
		this.FindName(CheckBox, "chk_multi")?.Click.Add(() =>
		{
			engine.SetAllowMulti(this.RequireName(CheckBox, "chk_multi").IsChecked);
		});
		this.FindName(CheckBox, "chk_block")?.Click.Add(() =>
		{
			engine.SetBlockTrigger(this.RequireName(CheckBox, "chk_block").IsChecked);
		});
		this.FindName(ListBox, "lst_peers")?.SelectionChanged.Add(() =>
		{
			if (MainControl.s_setting_)
				return;
			const list = this.RequireName(ListBox, "lst_peers");
			if (list.SelectedIndex >= 0)
			{
				this.peerSel_ = list.SelectedIndex;
				engine.TogglePeer(list.SelectedIndex);
			}
		});
		this.FindName(ListBox, "lst_map")?.SelectionChanged.Add(() =>
		{
			if (MainControl.s_setting_)
				return;
			const list = this.RequireName(ListBox, "lst_map");
			this.mapSel_ = list.SelectedIndex;
			this.UiMappings();
		});
		this.FindName(Button, "btn_map_add")?.Click.Add(() =>
		{
			engine.AddMapping(this.RequireName(TextBox, "txt_map_text").Text, this.RequireName(TextBox, "txt_map_func").Text);
			this.RequireName(TextBox, "txt_map_text").Text = "";
			this.RequireName(TextBox, "txt_map_func").Text = "";
		});
		this.FindName(Button, "btn_map_del")?.Click.Add(() =>
		{
			const list = this.RequireName(ListBox, "lst_map");
			if (list.SelectedIndex >= 0)
				engine.DelMapping(list.SelectedIndex);
		});
		this.FindName(Button, "btn_map_run")?.Click.Add(() =>
		{
			// 함수명 입력이 있으면 직접 실행, 비어 있으면 선택 행 실행.
			const typed = this.RequireName(TextBox, "txt_map_func").Text.trim();
			if (typed.length > 0)
			{
				void engine.RunFuncAsync(typed);
				return;
			}
			const list = this.RequireName(ListBox, "lst_map");
			if (list.SelectedIndex >= 0)
				void engine.RunMappingAsync(list.SelectedIndex);
		});
		this.FindName(TextBox, "txt_source")?.TextChanged.Add(() =>
		{
			if (!MainControl.s_setting_)
				engine.MarkEditorDirty();
		});
		this.FindName(Button, "btn_apply")?.Click.Add(() =>
		{
			void engine.ApplySourceAsync(this.RequireName(TextBox, "txt_source").Text);
		});
		this.FindName(Button, "btn_logclear")?.Click.Add(() =>
		{
			this.RequireName(Terminal, "log_view").Clear();
		});
		this.FindName(Button, "btn_key_add")?.Click.Add(() =>
		{
			engine.AddKey("gemini", this.RequireName(TextBox, "txt_key_name").Text, this.RequireName(TextBox, "txt_key_value").Text);
		});
		this.FindName(Button, "btn_key_update")?.Click.Add(() =>
		{
			const idx = this.RequireName(ListBox, "lst_keys").SelectedIndex;
			const id = this.keyIds_[idx];
			if (idx < 0 || id === undefined)
				return;
			engine.UpdateKey(id, this.RequireName(TextBox, "txt_key_name").Text, this.RequireName(TextBox, "txt_key_value").Text);
		});
		this.FindName(Button, "btn_key_update")?.Click.Add(() =>
		{
			const idx = this.RequireName(ListBox, "lst_keys").SelectedIndex;
			const id = this.keyIds_[idx];
			if (idx < 0 || id === undefined)
				return;
			engine.UpdateKey(id, this.RequireName(TextBox, "txt_key_name").Text, this.RequireName(TextBox, "txt_key_value").Text);
		});
		this.FindName(Button, "btn_key_del")?.Click.Add(() =>
		{
			const idx = this.RequireName(ListBox, "lst_keys").SelectedIndex;
			const id = this.keyIds_[idx];
			if (idx >= 0 && id !== undefined)
				engine.DeleteKey("gemini", id);
		});
		this.FindName(Button, "btn_key_apply")?.Click.Add(() =>
		{
			const idx = this.RequireName(ListBox, "lst_keys").SelectedIndex;
			const id = this.keyIds_[idx];
			if (idx >= 0 && id !== undefined)
				engine.ApplyKey("gemini", id);
		});
		this.FindName(Button, "btn_key_check")?.Click.Add(() =>
		{
			const idx = this.RequireName(ListBox, "lst_keys").SelectedIndex;
			const id = this.keyIds_[idx];
			if (idx >= 0 && id !== undefined)
				void engine.CheckKeyAsync("gemini", id);
		});
		this.FindName(ListBox, "lst_keys")?.SelectionChanged.Add(() =>
		{
			if (MainControl.s_setting_)
				return;
			const engine = MainControl.s_engine_;
			if (engine === null)
				return;
			const list = this.RequireName(ListBox, "lst_keys");
			const idx = list.SelectedIndex;
			const id = this.keyIds_[idx];
			engine.SelectKey(idx >= 0 && id !== undefined ? id : null);
			this.UiKeys();
		});
		this.RequireName(TextBox, "txt_host").Text = "0.0.0.0:9999";
		this.MountEq();
		this.PaintFrame(this.RequireName(ListBox, "lst_peers"));
		this.PaintFrame(this.RequireName(ListBox, "lst_map"));
		this.PaintFrame(this.RequireName(ListBox, "lst_keys"));
		engine.RefreshUi();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 보정 CSS를 문서에 1회 주입한다. 이미 있으면 아무것도 안 한다.
	private static EnsureStyle(): void
	{
		if (document.getElementById(MainControl.s_styleId_) !== null)
			return;
		const style = document.createElement("style");
		style.id = MainControl.s_styleId_;
		style.textContent = MainControl.s_viewCss_;
		document.head.append(style);
	}

	// ==================== EngineUi ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그 1건. 터미널 스타일 (시각 + 수준별 컬러).
	// @param _level: 수준
	// @param _msg: 메시지
	public UiLog(_level: "info" | "warn" | "error", _msg: string): void
	{
		const now = new Date();
		const pad = (_n: number): string => String(_n).padStart(2, "0");
		const ts = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
		const color = _level === "error" ? "var(--error)" : _level === "warn" ? "var(--warning)" : "var(--text-base)";
		this.RequireName(Terminal, "log_view").Append({ Text: `[${ts}] ${_msg}`, Color: color });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태 행.
	// @param _role: 역할
	// @param _conn: 접속 상세
	// @param _stt: STT 상태
	// @param _hb: 하트비트
	public UiStatus(_role: string, _conn: string, _stt: string, _hb: string): void
	{
		const conn = _conn.length > 0 ? ` ${_conn}` : "";
		this.data_.Set("statusText", `상태: ${_role}${conn}  STT: ${_stt}`);
		this.data_.Set("heartbeatText", `마지막 하트비트 수신: ${_hb}`);
		const engine = MainControl.s_engine_;
		const role = engine === null ? "idle" : engine.Role();
		const listen = this.FindName(Button, "btn_listen");
		const connect = this.FindName(Button, "btn_connect");
		const stop = this.FindName(Button, "btn_stop");
		if (listen !== null)
			listen.IsEnabled = role === "idle";
		if (connect !== null)
			connect.IsEnabled = role === "idle";
		if (stop !== null)
			stop.IsEnabled = role !== "idle";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인식 텍스트.
	// @param _text: 텍스트
	public UiRecognized(_text: string): void
	{
		MainControl.s_setting_ = true;
		try
		{
			this.RequireName(TextBox, "txt_recognized").Text = _text;
		}
		finally
		{
			MainControl.s_setting_ = false;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// partial 미리보기.
	// @param _text: 텍스트
	public UiPartial(_text: string): void
	{
		this.data_.Set("partialText", _text);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 듣기 중 EQ 애니메이션. WPF(MainWindow.xaml) 모방: 로그 헤더 왼쪽에 막대 5개+점.
	// Layout XML에 범용 컨테이너가 없어 코드로 생성해 지우기 버튼 앞에 꽂는다.
	private MountEq(): void
	{
		const clear = this.FindName(Button, "btn_logclear");
		if (clear === null)
			return;
		const parent = clear.Element.parentElement;
		if (parent === null)
			return;
		const eq = document.createElement("span");
		eq.className = "speexec-eq";
		for (let idx = 0; idx < 5; idx++)
			eq.append(document.createElement("i"));
		eq.append(document.createElement("b"));
		parent.insertBefore(eq, clear.Element);
		this.eqEl_ = eq;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 듣기 상태에 따라 EQ 표시 전환.
	// @param _on: 듣기 중
	public UiSttListening(_on: boolean): void
	{
		this.eqEl_?.classList.toggle("on", _on);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// STT 버튼 라벨.
	// @param _label: 라벨
	public UiSttButton(_label: string): void
	{
		const btn = this.FindName(Button, "btn_stt");
		if (btn !== null)
			btn.Content = _label;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록 프레임 배경/테두리. 최초 1회.
	// @param _list: 목록
	private PaintFrame(_list: ListBox): void
	{
		const el = _list.Element;
		el.style.background = "var(--background-panel)";
		el.style.border = "1px solid var(--border-weak-base)";
		el.style.borderRadius = "4px";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 목록을 채우고 선택 행을 하이라이트한다.
	// SetItems는 길이가 같으면 기존 행 텍스트를 갱신하지 않으므로
	// 비우고 다시 채워 강제 재생성한다.
	// @param _list: 목록
	// @param _rows: 행
	// @param _sel: 선택 행
	private PaintList(_list: ListBox, _rows: string[], _sel: number): void
	{
		MainControl.s_setting_ = true;
		try
		{
			_list.SetItems([]);
			_list.SetItems(_rows);
			_list.SelectedIndex = _sel;
			const kids: ReadonlyArray<UIElement> = _list.Children;
			for (let idx = 0; idx < kids.length; idx++)
			{
				const child = kids[idx];
				if (child === undefined)
					continue;
				const el = child.Element;
				if (idx === _sel)
				{
					el.style.background = "var(--primary)";
					el.style.color = "var(--primary-foreground)";
				}
				else
				{
					el.style.background = "transparent";
					el.style.color = "";
				}
			}
		}
		finally
		{
			MainControl.s_setting_ = false;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 목록 갱신. 행이 있으면 반드시 선택을 유지 (편집기 고착 방지).
	public UiKeys(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const rows = engine.KeyRows("gemini");
		this.keyIds_ = engine.KeyIds("gemini");
		let selId = engine.SelectedKeyId();
		if (selId === null && this.keyIds_.length > 0)
		{
			// 미선택이면 사용 중 키 우선, 없으면 첫 행을 자동 선택.
			const active = engine.ActiveKeyId("gemini");
			const fallback = this.keyIds_.includes(active) ? active : this.keyIds_[0] ?? null;
			if (fallback !== null)
			{
				engine.SelectKey(fallback);
				selId = fallback;
			}
		}
		this.keySel_ = selId === null ? -1 : this.keyIds_.indexOf(selId);
		this.PaintList(this.RequireName(ListBox, "lst_keys"), rows, this.keySel_);
		const on = this.keySel_ >= 0;
		for (const name of ["btn_key_del", "btn_key_apply", "btn_key_check", "btn_key_update"])
		{
			const btn = this.FindName(Button, name);
			if (btn !== null)
				btn.IsEnabled = on;
		}
		const detail = selId !== null ? engine.KeyDetail(selId) : null;
		this.data_.Set("editTargetText", detail !== null ? `편집 중: ${detail.Name}` : "새 키 입력 후 +추가를 누르세요");
		this.UiKeyDetail();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 상세 표시.
	private UiKeyDetail(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const idx = this.RequireName(ListBox, "lst_keys").SelectedIndex;
		this.keySel_ = idx;
		MainControl.s_setting_ = true;
		try
		{
			const id = this.keyIds_[idx];
			if (idx >= 0 && id !== undefined)
			{
				const detail = engine.KeyDetail(id);
				this.RequireName(TextBox, "txt_key_name").Text = detail?.Name ?? "";
				this.RequireName(TextBox, "txt_key_value").Text = detail?.ApiKey ?? "";
			}
			else
			{
				this.RequireName(TextBox, "txt_key_name").Text = "";
				this.RequireName(TextBox, "txt_key_value").Text = "";
			}
		}
		finally
		{
			MainControl.s_setting_ = false;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 매핑 목록 갱신.
	public UiMappings(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		this.PaintList(this.RequireName(ListBox, "lst_map"), engine.MappingRows(), this.mapSel_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 피어 목록 갱신. 각 행에 우클릭 체크 메뉴를 단다.
	public UiPeers(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		const list = this.RequireName(ListBox, "lst_peers");
		this.PaintList(list, engine.PeerRows(), this.peerSel_);
		const kids: ReadonlyArray<UIElement> = list.Children;
		for (let idx = 0; idx < kids.length; idx++)
		{
			const child = kids[idx];
			if (child === undefined)
				continue;
			const row = idx;
			const item = new MenuItem();
			item.Header = "전송 대상으로 체크";
			item.IsCheckable = true;
			item.IsChecked = engine.IsPeerChecked(row);
			item.Click.Add(() =>
			{
				engine.TogglePeer(row);
			});
			const menu = new ContextMenu();
			menu.AddItem(item);
			child.ContextMenu = menu;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 함수 소스 표시. 외부 플래그면 배지만 띄우고 덮어쓰지 않는다.
	// @param _text: 원문
	// @param _external: 외부 변경
	public UiSource(_text: string, _external: boolean): void
	{
		if (_external)
		{
			this.data_.Set("extText", "외부 변경 있음 - 적용 전 확인");
			return;
		}
		MainControl.s_setting_ = true;
		try
		{
			this.RequireName(TextBox, "txt_source").Text = _text;
		}
		finally
		{
			MainControl.s_setting_ = false;
		}
		this.data_.Set("extText", "");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 함수명 목록 표시 (매핑 검증용 로그).
	public UiFuncs(): void
	{
		const engine = MainControl.s_engine_;
		if (engine === null)
			return;
		this.data_.Set("funcText", `함수: ${engine.FuncNames().join(", ")}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 닉네임 표시.
	// @param _nick: 닉네임
	public UiNickname(_nick: string): void
	{
		MainControl.s_setting_ = true;
		try
		{
			const box = this.FindName(TextBox, "txt_nick");
			if (box !== null && box.Text.length === 0)
				box.Text = _nick;
		}
		finally
		{
			MainControl.s_setting_ = false;
		}
	}
}
