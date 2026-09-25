/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: SpeechEngine. STT→피어전송→트리거→함수 실행 오케스트레이션.
*/

import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as https from "node:https";
import * as path from "node:path";
import type { IPluginContext } from "@scouter/plugin-api";
import { KeyStore } from "./KeyStore";
import { FunctionStore } from "./FunctionStore";
import type { IFunctionApi } from "./FunctionStore";
import { NetLink } from "./NetLink";
import { SttClient } from "./SttClient";
import type { Role, ITriggerMapping } from "./Types";
import { IsTrigger, ParseHostPort, kWatchMs } from "./Types";

export interface IEngineUi
{
	Log(_level: "info" | "warn" | "error", _msg: string): void;
	Status(_role: string, _conn: string, _stt: string, _heartbeat: string): void;
	Recognized(_text: string): void;
	Partial(_text: string): void;
	Keys(_provider: string): void;
	Mappings(): void;
	Peers(): void;
	Source(_text: string, _external: boolean): void;
	Funcs(): void;
	Nickname(_nick: string): void;
	SttButton(_label: string): void;
	SttListening(_on: boolean): void;
}

export class SpeechEngine
{
	// ==================== 멤버 ====================
	private ctx_: IPluginContext | null = null;
	private ui_: IEngineUi | null = null;
	private keys_ = new KeyStore();
	private funcs_ = new FunctionStore();
	private link_ = new NetLink();
	private stt_ = new SttClient();
	private host_ = "0.0.0.0:9999";
	private exclusive_ = true;
	private blockTrigger_ = false;
	private recognized_ = "";
	private sttState_ = "정지";
	private sttOn_ = false;
	private selectedKeyId_: string | null = null;
	private connDetail_ = "";
	private role_: Role = "idle";
	private nickname_ = "";
	private lastHbText_ = "-";
	private editorDirty_ = false;
	private lastRun_ = 0;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 컨텍스트·UI를 묶고 저장값을 복원한다.
	// @param _ctx: 컨텍스트
	// @param _ui: UI 콜백
	public async BindAsync(_ctx: IPluginContext, _ui: IEngineUi): Promise<void>
	{
		this.ctx_ = _ctx;
		this.ui_ = _ui;
		const storageDir = _ctx.Paths.StorageDir;
		this.keys_.Bind(_ctx, storageDir);
		this.nickname_ = this.ReadTextFile(storageDir, "nickname.txt", "");
		this.link_.SetNickname(this.nickname_);
		this.exclusive_ = !_ctx.Settings.Get<boolean>("AllowMulti", false);
		this.blockTrigger_ = _ctx.Settings.Get<boolean>("BlockTrigger", false);
		await this.funcs_.InitAsync(storageDir);
		const saved = this.ReadJsonFile<ITriggerMapping[]>(storageDir, "mappings.json", []);
		if (Array.isArray(saved) && saved.length > 0)
			this.funcs_.SetMappings(saved);
		else
			this.funcs_.SetMappings([{ Text: "지우기", Func: "clearText" }, { Text: "안녕", Func: "hello" }]);
		this.link_.Bind({
			OnLog: (_level, _msg) =>
			{
				this.Log(_level, _msg);
			},
			OnPeerFinal: (_text) =>
			{
				this.OnPeerFinal(_text);
			},
			OnRole: (_role, _detail) =>
			{
				this.OnRole(_role, _detail);
			},
			OnHeartbeat: (_at, _nick) =>
			{
				this.OnHeartbeat(_at, _nick);
			},
			OnPeers: () =>
			{
				this.ui_?.Peers();
			},
		});
		this.stt_.Bind({
			OnPartial: (_text) =>
			{
				this.ui_?.Partial(_text);
			},
			OnFinal: (_text) =>
			{
				void this.OnLocalFinal(_text);
			},
			OnStatus: (_state, _detail) =>
			{
				this.OnSttStatus(_state, _detail);
			},
		});
		_ctx.Schedule.Interval(kWatchMs, () =>
		{
			void this.PollFunctionFileAsync();
		});
		this.RefreshAll();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 호스트 입력.
	// @param _host: "host:port"
	public SetHost(_host: string): void
	{
		this.host_ = _host;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 리스너 시작.
	public async ListenAsync(): Promise<void>
	{
		const hp = ParseHostPort(this.host_);
		if (hp === null)
		{
			this.Log("error", `호스트 형식 오류: ${this.host_} (host:port)`);
			return;
		}
		try
		{
			await this.link_.StartListen(hp.Host, hp.Port, this.exclusive_);
		}
		catch (_e)
		{
			this.Log("error", String(_e instanceof Error ? _e.message : _e));
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 클라이언트 접속.
	public async ConnectAsync(): Promise<void>
	{
		const hp = ParseHostPort(this.host_);
		if (hp === null)
		{
			this.Log("error", `호스트 형식 오류: ${this.host_} (host:port)`);
			return;
		}
		try
		{
			await this.link_.Connect(hp.Host, hp.Port);
		}
		catch (_e)
		{
			this.Log("error", String(_e instanceof Error ? _e.message : _e));
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 링크 종료. STT 듣기는 독립 동작이라 건드리지 않는다.
	public StopLink(): void
	{
		this.link_.Stop();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전체 종료. 링크·사이드카를 모두 내린다 (Unload·앱 종료용).
	public Shutdown(): void
	{
		this.sttOn_ = false;
		this.stt_.Stop();
		this.link_.Stop();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// STT 듣기 토글 (링크 없이 단독 인식 테스트 가능).
	public async ToggleSttAsync(): Promise<void>
	{
		if (this.sttOn_)
		{
			this.stt_.Listen(false);
			this.sttOn_ = false;
			this.ui_?.SttButton(this.SttLabel());
			this.ui_?.SttListening(false);
			return;
		}
		const key = this.keys_.ActiveKey("gemini");
		if (key.length === 0)
		{
			this.Log("error", "Gemini API 키가 없습니다. API 탭에서 추가·적용하세요.");
			return;
		}
		if (this.ctx_ === null)
			return;
		try
		{
			const python = this.ctx_.Settings.Get<string>("PythonExe", "python");
			const pluginDir = this.ctx_.Paths.PluginDir;
			const serverPy = path.join(pluginDir, "sidecar", "asr_server.py");
			await this.stt_.Start(python, serverPy, "gemini-3.5-transcribe-live", "ko-KR", key);
			this.stt_.Listen(true);
			this.sttOn_ = true;
			this.ui_?.SttButton(this.SttLabel());
			this.ui_?.SttListening(true);
		}
		catch (_e)
		{
			this.Log("error", `STT 시작 실패: ${_e instanceof Error ? _e.message : String(_e)}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// STT 버튼 라벨.
	private SttLabel(): string
	{
		return this.sttOn_ ? "⏹ 듣기 중지" : "🎤 듣기 시작";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 다중 클라이언트 허용 조회.
	public AllowMulti(): boolean
	{
		return !this.exclusive_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 다중 클라이언트 허용 설정 (끄면 1:1 독점).
	// @param _on: 켜짐
	public SetAllowMulti(_on: boolean): void
	{
		this.exclusive_ = !_on;
		this.SaveUiSetting("AllowMulti", _on);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 트리거 차단 조회.
	public BlockTrigger(): boolean
	{
		return this.blockTrigger_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 트리거 차단 설정.
	// @param _on: 켜짐
	public SetBlockTrigger(_on: boolean): void
	{
		this.blockTrigger_ = _on;
		this.SaveUiSetting("BlockTrigger", _on);
		this.Log("info", _on ? "트리거 차단 켜짐 (매칭 생략)" : "트리거 차단 꺼짐");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// UI 설정 1건을 settings.json에 저장. 실패해도 토글은 유지.
	// @param _key: 키
	// @param _value: 값
	private SaveUiSetting(_key: string, _value: boolean): void
	{
		try
		{
			this.ctx_?.Settings.Set(_key, _value);
		}
		catch
		{
			// 무시.
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 닉네임 조회·지정.
	public Nickname(): string
	{
		return this.nickname_;
	}
	//////////////////////////////////////////////////////////////////////////////////////
	// 닉네임 지정. 저장소에 보관.
	// @param _nick: 닉네임
	public SetNickname(_nick: string): void
	{
		this.nickname_ = _nick.trim();
		this.link_.SetNickname(this.nickname_);
		if (this.ctx_ !== null)
			this.ctx_.Storage.Set("nickname", this.nickname_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 피어 행 문자열 ("✓ nick@addr 마지막수신 ..").
	public PeerRows(): string[]
	{
		return this.link_.Peers().map((_p) =>
		{
			const hb = _p.LastHb.getTime() === 0 ? "-" : _p.LastHb.toLocaleTimeString();
			const mark = _p.Checked ? "✓ " : "  ";
			return `${mark}${_p.Nick}@${_p.Addr} 마지막수신 ${hb}`;
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 피어 닉네임 목록 (행 순서 대응).
	public PeerNicks(): string[]
	{
		return this.link_.Peers().map((_p) => _p.Nick);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 피어 체크 여부 (우클릭 메뉴 표시용).
	// @param _index: 행 번호
	public IsPeerChecked(_index: number): boolean
	{
		const peers = this.link_.Peers();
		const peer = peers[_index];
		return peer !== undefined && peer.Checked;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 피어 대상 체크 토글.
	// @param _index: 행 번호
	public TogglePeer(_index: number): void
	{
		const nicks = this.PeerNicks();
		if (_index < 0 || _index >= nicks.length)
			return;
		const nick = nicks[_index];
		if (nick === undefined)
			return;
		this.link_.ToggleTarget(nick);
		this.ui_?.Peers();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 역할.
	public Role(): Role
	{
		return this.role_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 매핑 추가.
	// @param _text: 음성 텍스트
	// @param _func: 함수명
	public AddMapping(_text: string, _func: string): void
	{
		if (_text.trim().length === 0 || _func.trim().length === 0)
			return;
		const rows = this.funcs_.Mappings();
		rows.push({ Text: _text.trim(), Func: _func.trim() });
		this.funcs_.SetMappings(rows);
		this.SaveMappings();
		this.ui_?.Mappings();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 매핑 삭제.
	// @param _index: 행 번호
	public DelMapping(_index: number): void
	{
		const rows = this.funcs_.Mappings();
		if (_index < 0 || _index >= rows.length)
			return;
		rows.splice(_index, 1);
		this.funcs_.SetMappings(rows);
		this.SaveMappings();
		this.ui_?.Mappings();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 매핑 행 문자열.
	public MappingRows(): string[]
	{
		return this.funcs_.Mappings().map((_m) => `${_m.Text} → ${_m.Func}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 함수명으로 직접 테스트 실행한다. ctx.Text는 현재 인식 텍스트.
	// @param _name: 함수명
	public async RunFuncAsync(_name: string): Promise<void>
	{
		const name = _name.trim();
		if (name.length === 0)
			return;
		this.Log("info", `함수 실행 ${name}()`);
		try
		{
			await this.funcs_.RunAsync(name, this.MakeApi(), this.recognized_);
			this.Log("info", `함수 완료 ${name}()`);
		}
		catch (_e)
		{
			this.Log("error", `함수 실패 ${name}: ${_e instanceof Error ? _e.message : String(_e)}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택 매핑의 함수를 테스트 실행한다. 발화 대신 매핑 텍스트를 전달.
	// @param _index: 행 번호
	public async RunMappingAsync(_index: number): Promise<void>
	{
		const rows = this.funcs_.Mappings();
		const row = rows[_index];
		if (row === undefined)
			return;
		this.Log("info", `테스트 실행 ${row.Func}() ← "${row.Text}"`);
		try
		{
			await this.funcs_.RunAsync(row.Func, this.MakeApi(), row.Text);
		}
		catch (_e)
		{
			this.Log("error", `함수 실패 ${row.Func}: ${_e instanceof Error ? _e.message : String(_e)}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에디터 내용이 바뀌었음을 알린다.
	public MarkEditorDirty(): void
	{
		this.editorDirty_ = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에디터 적용: 파일 쓰기 + 재컴파일.
	// @param _source: 원문
	public async ApplySourceAsync(_source: string): Promise<void>
	{
		const result = await this.funcs_.ApplySourceAsync(_source);
		this.editorDirty_ = false;
		if (result.Ok)
		{
			this.Log("info", `함수 적용됨: ${result.Funcs.join(", ")}`);
			this.ui_?.Funcs();
			this.ui_?.Source(_source, false);
		}
		else
		{
			this.Log("error", `함수 컴파일 실패: ${result.Error}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인식 텍스트 비우기.
	public ClearRecognized(): void
	{
		this.recognized_ = "";
		this.ui_?.Recognized("");
		this.stt_.Reset();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 목록.
	// @param _provider: 제공자
	public KeyRows(_provider: string): string[]
	{
		const active = this.keys_.ActiveId(_provider);
		return this.keys_.List(_provider).map((_k) => `${_k.Name}${_k.Id === active ? "  ✔ 사용 중" : ""}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 id 목록 (행 순서 대응).
	// @param _provider: 제공자
	public KeyIds(_provider: string): string[]
	{
		return this.keys_.List(_provider).map((_k) => _k.Id);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 상세.
	// @param _id: 키 id
	public KeyDetail(_id: string): { Name: string; ApiKey: string } | null
	{
		const hit = this.keys_.List("gemini").concat(this.keys_.List("elevenlabs")).find((_k) => _k.Id === _id);
		if (hit === undefined)
			return null;
		return { Name: hit.Name, ApiKey: hit.ApiKey };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선택된 키 id (gemini 목록 기준).
	public SelectedKeyId(): string | null
	{
		return this.selectedKeyId_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용 중 키 id.
	// @param _provider: 제공자
	public ActiveKeyId(_provider: string): string
	{
		return this.keys_.ActiveId(_provider);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 선택을 기록한다 (복제 추가용). null이면 선택 해제.
	// @param _id: 키 id
	public SelectKey(_id: string | null): void
	{
		this.selectedKeyId_ = _id;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 추가. 에디터 입력값으로 등록하고 선택한다.
	// @param _provider: 제공자
	// @param _name: 이름
	// @param _key: 키
	public AddKey(_provider: string, _name: string, _key: string): void
	{
		const made = this.keys_.Add(_provider, _name, _key);
		this.selectedKeyId_ = made.Id;
		this.ui_?.Keys(_provider);
		this.Log("info", `API 키 추가: ${made.Name} (${_provider})`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 삭제.
	// @param _provider: 제공자
	// @param _id: 키 id
	public DeleteKey(_provider: string, _id: string): void
	{
		this.keys_.Delete(_id);
		if (this.selectedKeyId_ === _id)
			this.selectedKeyId_ = null;
		this.ui_?.Keys(_provider);
		this.Log("info", `API 키 삭제 (${_provider})`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 적용 (사용 중 지정).
	// @param _provider: 제공자
	// @param _id: 키 id
	public ApplyKey(_provider: string, _id: string): void
	{
		this.keys_.Apply(_provider, _id);
		const detail = this.KeyDetail(_id);
		this.ui_?.Keys(_provider);
		this.Log("info", `API 키 적용: ${detail?.Name ?? _id} (${_provider})`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 상세 수정 (변경 버튼 전용 쓰기 경로).
	// @param _id: 키 id
	// @param _name: 이름
	// @param _key: 키
	public UpdateKey(_id: string, _name: string, _key: string): void
	{
		this.keys_.Update(_id, _name, _key);
		this.ui_?.Keys("gemini");
		this.Log("info", `API 키 변경: ${_name.trim().length > 0 ? _name.trim() : _id}`);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키 유효성 확인.
	// @param _provider: 제공자
	// @param _id: 키 id
	public async CheckKeyAsync(_provider: string, _id: string): Promise<void>
	{
		const detail = this.KeyDetail(_id);
		if (detail === null || detail.ApiKey.trim().length === 0)
		{
			this.Log("warn", "확인 실패: 키를 먼저 선택·입력하세요.");
			return;
		}
		this.Log("info", `키 확인 중 (${_provider})...`);
		try
		{
			if (_provider === "gemini")
			{
				// 렌더러 fetch는 CSP(connect-src)에 막히므로 node:https로 직접 호출 (WPF HttpClient와 동등).
				const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(detail.ApiKey)}&pageSize=1`;
				const res = await SpeechEngine.HttpsGet(url);
				if (res.Status >= 200 && res.Status < 300)
					this.Log("info", "Gemini 키 정상");
				else
					this.Log("error", `Gemini 키 오류 (${String(res.Status)}): ${res.Body.slice(0, 150)}`);
			}
			else
			{
				this.Log("warn", `확인 미지원 제공자: ${_provider}`);
			}
		}
		catch (_e)
		{
			this.Log("error", `확인 실패: ${_e instanceof Error ? _e.message : String(_e)}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// HTTPS GET. CSP 우회용 node:https 직접 호출.
	// @param _url: 주소
	private static HttpsGet(_url: string): Promise<{ Status: number; Body: string }>
	{
		return new Promise((_resolve, _reject) =>
		{
			const req = https.get(_url, { timeout: 30000 }, (_res) =>
			{
				const chunks: Buffer[] = [];
				_res.on("data", (_c: Buffer | string) =>
				{
					chunks.push(Buffer.isBuffer(_c) ? _c : Buffer.from(_c));
				});
				_res.on("end", () =>
				{
					_resolve({ Status: _res.statusCode ?? 0, Body: Buffer.concat(chunks).toString("utf-8") });
				});
			});
			req.on("error", (_e: unknown) =>
			{
				_reject(_e instanceof Error ? _e : new Error(String(_e)));
			});
			req.on("timeout", () =>
			{
				req.destroy(new Error("timeout"));
			});
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 피어에게 텍스트 1건 전송 (Tool용).
	// @param _text: 텍스트
	public SendText(_text: string): void
	{
		if (this.role_ === "idle")
		{
			this.Log("warn", "전송 실패: 연결 없음");
			return;
		}
		this.link_.SendFinal(_text);
		this.Log("info", `전송: ${_text}`);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그 + UI 상태 갱신.
	// @param _level: 수준
	// @param _msg: 메시지
	private Log(_level: "info" | "warn" | "error", _msg: string): void
	{
		this.ui_?.Log(_level, _msg);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 역할 변경. 연결/끊김을 로그에 남긴다 (C# WPF와 동일).
	// @param _role: 역할
	// @param _detail: 상세
	private OnRole(_role: Role, _detail: string): void
	{
		const prev = this.role_;
		this.role_ = _role;
		this.connDetail_ = _detail;
		if (_role === "listening")
			this.Log("info", `리스너 연결됨 (${_detail})`);
		else if (_role === "connected")
			this.Log("info", `서버 연결됨 (${_detail})`);
		else if (prev !== "idle")
			this.Log("info", "연결 끊어짐");
		this.PushStatus();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 하트비트 수신.
	// @param _at: 시각
	// @param _nick: 상대
	private OnHeartbeat(_at: Date, _nick: string): void
	{
		this.lastHbText_ = `${_nick} ${_at.toLocaleTimeString()}`;
		this.PushStatus();
		this.ui_?.Peers();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 상태 행 갱신.
	private PushStatus(): void
	{
		const role = this.role_ === "idle" ? "대기중" : this.role_ === "listening" ? `리스닝중 ${this.connDetail_}` : `연결됨 ${this.connDetail_}`;
		this.ui_?.Status(role, this.connDetail_, this.sttState_, this.lastHbText_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// STT 상태.
	// @param _state: 상태
	// @param _detail: 상세
	private OnSttStatus(_state: string, _detail: string): void
	{
		if (_state === "connected" || _state === "disconnected")
		{
			this.Log("info", _detail);
			return;
		}
		if (_state === "error")
		{
			this.sttState_ = "오류";
			this.Log("error", _detail.split("\n").map((_l) => _l.trim()).filter((_l) => _l.length > 0).pop() ?? _detail);
			this.PushStatus();
			return;
		}
		if (_state === "ready" || _state === "listening")
		{
			this.sttState_ = _state === "ready" ? "대기중" : "듣는중";
			this.PushStatus();
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로컬 final 처리: 표시 + 피어 전송 + 트리거.
	// @param _text: 텍스트
	private async OnLocalFinal(_text: string): Promise<void>
	{
		const text = _text.trim();
		if (text.length === 0)
			return;
		this.recognized_ = this.recognized_.length === 0 ? text : `${this.recognized_}\n${text}`;
		this.ui_?.Recognized(this.recognized_);
		this.Log("info", `인식: ${text}`);
		if (this.role_ !== "idle")
			this.link_.SendFinal(text);
		await this.RunTriggersAsync(text);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 트리거 매칭·실행. 차단 켜짐이면 생략.
	// @param _text: 텍스트
	private async RunTriggersAsync(_text: string): Promise<void>
	{
		if (this.blockTrigger_)
			return;
		const rows = this.funcs_.Mappings();
		for (let idx = 0; idx < rows.length; idx++)
		{
			const row = rows[idx];
			if (row === undefined)
				continue;
			if (!IsTrigger(_text, row.Text))
				continue;
			const name = row.Func;
			this.Log("info", `매칭 "${row.Text}" → ${name}()`);
			try
			{
				await this.funcs_.RunAsync(name, this.MakeApi(), _text);
			}
			catch (_e)
			{
				this.Log("error", `함수 실패 ${name}: ${_e instanceof Error ? _e.message : String(_e)}`);
			}
			return;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 피어 수신 텍스트: 표시 + 트리거 실행. 재전송은 하지 않아 루프 없음.
	// @param _text: 텍스트
	private OnPeerFinal(_text: string): void
	{
		const text = _text.trim();
		if (text.length === 0)
			return;
		this.recognized_ = this.recognized_.length === 0 ? text : `${this.recognized_}\n${text}`;
		this.ui_?.Recognized(this.recognized_);
		void this.RunTriggersAsync(text);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 함수용 API.
	private MakeApi(): IFunctionApi
	{
		return {
			SendText: (_text: string): void =>
			{
				this.SendText(_text);
			},
			ClearText: (): void =>
			{
				this.ClearRecognized();
			},
			Log: (_msg: string): void =>
			{
				this.Log("info", _msg);
			},
			Alert: (_text: string): Promise<unknown> =>
			{
				if (this.ctx_ === null)
					return Promise.resolve(false);
				return this.ctx_.Ui.MessageBox({ Scope: "App", Title: "SpeechExecutor", Message: _text, Kind: "ok" });
			},
			Exec: (_cmd: string, _args: string[]): Promise<{ Code: number; Stdout: string; Stderr: string }> =>
			{
				return new Promise((_resolve, _reject) =>
				{
					execFile(_cmd, _args, { timeout: 60000 }, (_err, _stdout, _stderr) =>
					{
						if (_err !== null && _stdout.length === 0)
						{
							_reject(_err.message.length > 0 ? new Error(_err.message) : new Error("exec 실패"));
							return;
						}
						_resolve({ Code: _err !== null ? 1 : 0, Stdout: _stdout, Stderr: _stderr });
					});
				});
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 매핑 저장.
	private SaveMappings(): void
	{
		if (this.ctx_ === null)
			return;
		this.WriteJsonFile(this.ctx_.Paths.StorageDir, "mappings.json", this.funcs_.Mappings());
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트 파일 읽기. 없으면 기본값.
	// @param _dir: 폴더
	// @param _file: 파일명
	// @param _def: 기본값
	private ReadTextFile(_dir: string, _file: string, _def: string): string
	{
		try
		{
			return readFileSync(path.join(_dir, _file), "utf-8");
		}
		catch
		{
			return _def;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// JSON 파일 읽기. 없으면 기본값.
	// @param _dir: 폴더
	// @param _file: 파일명
	// @param _def: 기본값
	private ReadJsonFile<T>(_dir: string, _file: string, _def: T): T
	{
		try
		{
			return JSON.parse(readFileSync(path.join(_dir, _file), "utf-8")) as T;
		}
		catch
		{
			return _def;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 텍스트 파일 쓰기.
	// @param _dir: 폴더
	// @param _file: 파일명
	// @param _text: 내용
	private WriteTextFile(_dir: string, _file: string, _text: string): void
	{
		try
		{
			mkdirSync(path.dirname(path.join(_dir, _file)), { recursive: true });
			writeFileSync(path.join(_dir, _file), _text, "utf-8");
		}
		catch
		{
			// 무시.
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// JSON 파일 쓰기.
	// @param _dir: 폴더
	// @param _file: 파일명
	// @param _value: 값
	private WriteJsonFile(_dir: string, _file: string, _value: unknown): void
	{
		this.WriteTextFile(_dir, _file, JSON.stringify(_value, null, 2));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 함수 파일 외부 변경 폴링.
	private async PollFunctionFileAsync(): Promise<void>
	{
		const mtime = await this.funcs_.MtimeAsync();
		if (mtime === 0 || mtime === this.funcs_.LoadedMtime())
			return;
		if (this.editorDirty_)
		{
			this.ui_?.Source("", true);
			return;
		}
		const result = await this.funcs_.LoadFromFileAsync();
		if (result.Ok)
		{
			const source = await this.funcs_.ReadSourceAsync();
			this.Log("info", `함수 파일 외부 변경 반영: ${result.Funcs.join(", ")}`);
			this.ui_?.Source(source, false);
			this.ui_?.Funcs();
		}
		else
		{
			this.Log("error", `함수 파일 오류: ${result.Error}`);
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록된 함수명 목록.
	public FuncNames(): string[]
	{
		return this.funcs_.FuncNames();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전체 UI 새로고침. 뷰가 늦게 열릴 때 OnInit에서 호출.
	public RefreshUi(): void
	{
		this.RefreshAll();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전체 UI 새로고침.
	private RefreshAll(): void
	{
		this.ui_?.Recognized(this.recognized_);
		this.ui_?.Partial("");
		this.ui_?.Mappings();
		this.ui_?.Keys("gemini");
		this.ui_?.Funcs();
		this.ui_?.Peers();
		this.ui_?.Nickname(this.nickname_);
		this.ui_?.SttButton(this.SttLabel());
		this.ui_?.SttListening(this.sttOn_);
		void this.RefreshSourceAsync();
		this.PushStatus();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 에디터 원문 로드.
	private async RefreshSourceAsync(): Promise<void>
	{
		try
		{
			const source = await this.funcs_.ReadSourceAsync();
			this.ui_?.Source(source, false);
		}
		catch
		{
			// 무시.
		}
	}
}
