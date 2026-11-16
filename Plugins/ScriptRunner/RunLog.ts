/*
	작성자: 윤정도
	생성일: 2026-11-14
	=====
	설명: RunLog. 스크립트 실행 로그(시작·출력·종료·예약 알림 줄)를 모아 두는 저장소.
	      최근 MaxLines 줄만 남기고 logs/history.log에 써서 앱을 다시 켜도 남는다.
	      파일 한 줄은 "YYYY-MM-DD HH:mm:ss.SSS<TAB>Id<TAB>제목<TAB>내용"이다.
	      Fs에 덧붙이기가 없어 파일을 통째로 다시 쓰고, 쓰기는 모아서 1초 뒤에 한 번 한다.
*/

import type { IRunLogLine, IRunLogOptions, ITextFs, TRunLogListener } from "./Types";

const kSaveDelayMs = 1000;
const kMinLines = 100;
const kLineRe = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})\t([^\t]*)\t([^\t]*)\t(.*)$/;

//////////////////////////////////////////////////////////////////////////////////////
// 두 자리로 0을 채운다.
// @param _value: 숫자
function Pad2(_value: number): string
{
	return _value < 10 ? `0${_value}` : String(_value);
}

//////////////////////////////////////////////////////////////////////////////////////
// 세 자리로 0을 채운다.
// @param _value: 숫자
function Pad3(_value: number): string
{
	return _value < 10 ? `00${_value}` : _value < 100 ? `0${_value}` : String(_value);
}

export class RunLog
{
	// ==================== 멤버 ====================
	private readonly fs_: ITextFs;
	private readonly path_: string;
	private readonly options_: IRunLogOptions;
	private readonly listeners_ = new Set<TRunLogListener>();
	private lines_: IRunLogLine[] = [];
	private timer_: ReturnType<typeof setTimeout> | null = null;
	private dirty_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 창구·파일 경로·설정 getter를 주입받는다.
	// @param _fs: UTF-8 텍스트 읽기·쓰기 창구
	// @param _path: history.log 경로
	// @param _options: 설정 getter 묶음
	public constructor(_fs: ITextFs, _path: string, _options: IRunLogOptions)
	{
		this.fs_ = _fs;
		this.path_ = _path;
		this.options_ = _options;
	}

	// ==================== 속성 ====================
	public get Count(): number { return this.lines_.length; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일을 읽어 지난 로그를 올린다. 읽는 동안 쌓인 줄은 뒤에 이어 붙인다. 파일이 없으면 빈 로그다.
	public async LoadAsync(): Promise<void>
	{
		let text = "";
		try
		{
			text = await this.fs_.ReadText(this.path_);
		}
		catch
		{
			text = "";
		}
		const loaded: IRunLogLine[] = [];
		for (const raw of text.split(/\r?\n/))
		{
			const line = RunLog.Parse(raw);
			if (line !== null)
				loaded.push(line);
		}
		this.lines_ = [...loaded, ...this.lines_];
		this.Trim();
		this.Notify([], true);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 줄을 쌓는다. 제목의 탭과 내용의 줄바꿈 문자는 한 줄 형식을 깨지 않게 공백으로 바꾼다.
	// @param _lines: 쌓을 줄
	public Add(_lines: ReadonlyArray<IRunLogLine>): void
	{
		if (_lines.length === 0)
			return;
		const clean = _lines.map((_l) => ({
			Ts: _l.Ts,
			EntryId: _l.EntryId.replace(/\t/g, " "),
			Title: _l.Title.replace(/\t/g, " "),
			Text: _l.Text.replace(/[\r\n]/g, " "),
		}));
		this.lines_.push(...clean);
		this.Trim();
		this.Notify(clean, false);
		this.ScheduleSave();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 최근 줄을 돌려준다. Id를 주면 그 항목 줄만, 개수를 주면 끝에서 그만큼만.
	// @param _entryId: 항목 Id(빈 문자열이면 전체)
	// @param _limit: 최대 줄 수(0 이하면 전부)
	public List(_entryId: string = "", _limit: number = 0): IRunLogLine[]
	{
		const picked = _entryId.length > 0 ? this.lines_.filter((_l) => _l.EntryId === _entryId) : [...this.lines_];
		return _limit > 0 && picked.length > _limit ? picked.slice(picked.length - _limit) : picked;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그를 전부 지우고 파일도 비운다.
	public Clear(): void
	{
		this.lines_ = [];
		this.Notify([], true);
		this.ScheduleSave();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 모아 둔 쓰기를 바로 한다. 언로드 때 부른다.
	public async FlushAsync(): Promise<void>
	{
		if (this.timer_ !== null)
		{
			clearTimeout(this.timer_);
			this.timer_ = null;
		}
		if (!this.dirty_)
			return;
		this.dirty_ = false;
		const text = this.lines_.map((_l) => RunLog.Serialize(_l)).join("\n");
		try
		{
			await this.fs_.WriteText(this.path_, text.length > 0 ? `${text}\n` : "");
		}
		catch
		{
			this.dirty_ = true;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 변경 구독. 해지 함수를 돌려준다. reset이 true면 목록을 통째로 다시 읽어야 한다(불러오기·지우기).
	// @param _handler: 변경 알림
	public OnChanged(_handler: TRunLogListener): () => void
	{
		this.listeners_.add(_handler);
		return () => { this.listeners_.delete(_handler); };
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 화면·Tool용 한 줄 문구. "MM-DD HH:mm:ss [Id 제목] 내용".
	// @param _line: 로그 줄
	public static Format(_line: IRunLogLine): string
	{
		const at = new Date(_line.Ts);
		const stamp = `${Pad2(at.getMonth() + 1)}-${Pad2(at.getDate())} ${Pad2(at.getHours())}:${Pad2(at.getMinutes())}:${Pad2(at.getSeconds())}`;
		return `${stamp} [${_line.EntryId} ${_line.Title}] ${_line.Text}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 한 줄로 만든다.
	// @param _line: 로그 줄
	public static Serialize(_line: IRunLogLine): string
	{
		const at = new Date(_line.Ts);
		const stamp = `${at.getFullYear()}-${Pad2(at.getMonth() + 1)}-${Pad2(at.getDate())} ${Pad2(at.getHours())}:${Pad2(at.getMinutes())}:${Pad2(at.getSeconds())}.${Pad3(at.getMilliseconds())}`;
		return `${stamp}\t${_line.EntryId}\t${_line.Title}\t${_line.Text}`;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 한 줄을 읽는다. 형식이 틀리면 null.
	// @param _text: 파일 한 줄
	public static Parse(_text: string): IRunLogLine | null
	{
		const match = kLineRe.exec(_text);
		if (match === null)
			return null;
		const ts = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]), Number(match[7])).getTime();
		return { Ts: ts, EntryId: match[8] ?? "", Title: match[9] ?? "", Text: match[10] ?? "" };
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 최대 줄 수를 넘는 오래된 줄을 버린다.
	private Trim(): void
	{
		const max = Math.max(kMinLines, Math.round(this.options_.MaxLines()));
		if (this.lines_.length > max)
			this.lines_ = this.lines_.slice(this.lines_.length - max);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 쓰기를 1초 뒤로 모은다.
	private ScheduleSave(): void
	{
		this.dirty_ = true;
		if (this.timer_ !== null)
			return;
		this.timer_ = setTimeout(() =>
		{
			this.timer_ = null;
			void this.FlushAsync();
		}, kSaveDelayMs);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 구독자에게 알린다. 구독자 예외는 삼킨다.
	// @param _added: 새로 쌓인 줄
	// @param _reset: 목록을 통째로 다시 읽어야 하는지
	private Notify(_added: IRunLogLine[], _reset: boolean): void
	{
		for (const handler of [...this.listeners_])
		{
			try
			{
				handler(_added, _reset);
			}
			catch
			{
				// 무시. 화면 갱신 실패가 로그 쌓기를 막으면 안 된다.
			}
		}
	}
}
