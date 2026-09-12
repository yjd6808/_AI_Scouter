/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P4Runner. p4 -ztag 실행 + 구조화. exec 주입으로 테스트.
*/

import { ZtagParser } from "./ZtagParser";
import type { ZtagRecord, IChangeInfo, IDescribeInfo, IFileEntry, IOpenedInfo, IAnnotateLine, IP4Exec, IP4Settings, IP4Runner } from "./Types";

const kTimeoutMs = 120_000;
const kMaxOutputBytes = 64 * 1024 * 1024;

export class P4Error extends Error
{
	public readonly Kind: "NotLoggedIn" | "CommandFailed" | "NotFound";

	//////////////////////////////////////////////////////////////////////////////////////
	// 종류와 메시지로 만든다.
	// @param _kind: 종류
	// @param _message: 메시지
	// @param _detail: 상세
	public constructor(_kind: "NotLoggedIn" | "CommandFailed" | "NotFound", _message: string, _detail = "")
	{
		super(_detail.length > 0 ? `${_message}\n${_detail}` : _message);
		this.Kind = _kind;
	}
}

//////////////////////////////////////////////////////////////////////////////////////
// 단일 값을 꺼낸다. 배열이면 첫 항목.
// @param _record: 레코드
// @param _key: 키
function One(_record: ZtagRecord, _key: string): string
{
	const value = _record[_key];
	if (Array.isArray(value))
		return value[0] ?? "";
	return value ?? "";
}

//////////////////////////////////////////////////////////////////////////////////////
// 숫자로 굳힌다. 실패면 기본값.
// @param _text: 원문
// @param _def: 기본값
function Num(_text: string, _def: number): number
{
	const parsed = Number(_text);
	return Number.isNaN(parsed) ? _def : parsed;
}

//////////////////////////////////////////////////////////////////////////////////////
// describe 레코드를 파일 목록으로 푼다.
// @param _record: 레코드
// @param _change: 체인지 번호
function FilesOf(_record: ZtagRecord, _change: number): IFileEntry[]
{
	const paths = _record["depotFile"];
	const list = Array.isArray(paths) ? paths : (paths !== undefined ? [paths] : []);
	const out: IFileEntry[] = [];
	for (let idx = 0; idx < list.length; ++idx)
	{
		const revs = _record["rev"];
		const actions = _record["action"];
		const types = _record["type"];
		const revList = Array.isArray(revs) ? revs : (revs !== undefined ? [revs] : []);
		const actionList = Array.isArray(actions) ? actions : (actions !== undefined ? [actions] : []);
		const typeList = Array.isArray(types) ? types : (types !== undefined ? [types] : []);
		out.push({
			DepotPath: list[idx] ?? "",
			Rev: Num(revList[idx] ?? "", 0),
			Action: actionList[idx] ?? "",
			Change: _change,
			Type: typeList[idx] ?? "",
		});
	}
	return out;
}

let sShared: P4Runner | null = null;

//////////////////////////////////////////////////////////////////////////////////////
// UI용 공유 러너를 둔다. Index가 Activate에서 1회.
// @param _runner: 러너
export function ConfigureShared(_runner: P4Runner): void
{
	sShared = _runner;
}

//////////////////////////////////////////////////////////////////////////////////////
// 공유 러너를 구한다. 없으면 throw.
// @return 러너
export function Shared(): P4Runner
{
	if (sShared === null)
		throw new Error("[P4Util] 러너 미초기화");
	return sShared;
}

export class P4Runner implements IP4Runner
{
	// ==================== 멤버 ====================
	private readonly exec_: IP4Exec;
	private readonly settings_: IP4Settings;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// exec와 설정으로 만든다.
	// @param _exec: 실행기(ctx.Shell.Exec)
	// @param _settings: 설정 스냅샷
	public constructor(_exec: IP4Exec, _settings: IP4Settings)
	{
		this.exec_ = _exec;
		this.settings_ = _settings;
	}

	// ==================== 속성 ====================
	public get Settings(): IP4Settings { return this.settings_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 범위 체인지 목록을 구한다.
	// @param _depot: 디포 경로
	// @param _from: 시작 리비전
	// @param _to: 끝 리비전
	// @param _signal: 취소 신호
	public async Changes(_depot: string, _from: number, _to: number, _signal?: AbortSignal): Promise<IChangeInfo[]>
	{
		const records = await this.RunAsync(["changes", "-s", "submitted", `${_depot}@${_from},${_to}`], _signal);
		return records.map((_r) => ({
			Change: Num(One(_r, "change"), 0),
			Date: One(_r, "time"),
			User: One(_r, "user"),
			Description: One(_r, "desc"),
		})).filter((_c) => _c.Change > 0);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 체인지 상세를 배치로 구한다.
	// @param _changes: 체인지 번호들
	// @param _signal: 취소 신호
	public async Describe(_changes: number[], _signal?: AbortSignal): Promise<IDescribeInfo[]>
	{
		const out: IDescribeInfo[] = [];
		const batch = Math.max(1, this.settings_.DescribeBatch);
		for (let idx = 0; idx < _changes.length; idx += batch)
		{
			_signal?.throwIfAborted();
			const slice = _changes.slice(idx, idx + batch);
			const records = await this.RunAsync(["describe", "-s", ...slice.map((_c) => String(_c))], _signal);
			for (const record of records)
			{
				const change = Num(One(record, "change"), 0);
				out.push({
					Change: change,
					User: One(record, "user"),
					Description: One(record, "desc"),
					Files: FilesOf(record, change),
				});
			}
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 열린 파일 목록을 구한다.
	// @param _client: 클라이언트(빈 문자열이면 기본)
	// @param _signal: 취소 신호
	public async Opened(_client: string, _signal?: AbortSignal): Promise<IOpenedInfo[]>
	{
		const args = _client.length > 0 ? ["opened", "-c", _client] : ["opened"];
		const records = await this.RunAsync(args, _signal);
		return records.map((_r) => ({
			DepotPath: One(_r, "depotFile"),
			Action: One(_r, "action"),
			Change: Num(One(_r, "change"), 0),
			Type: One(_r, "type"),
		}));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 책임자를 구한다. 파일당 1 레코드의 line/change 배열.
	// @param _path: 디포 경로
	// @param _signal: 취소 신호
	public async Annotate(_path: string, _signal?: AbortSignal): Promise<IAnnotateLine[]>
	{
		const records = await this.RunAsync(["annotate", "-c", _path], _signal);
		const first = records[0];
		if (first === undefined)
			return [];
		const lines = first["line"];
		const changes = first["change"];
		const lineList = Array.isArray(lines) ? lines : (lines !== undefined ? [lines] : []);
		const changeList = Array.isArray(changes) ? changes : (changes !== undefined ? [changes] : []);
		return lineList.map((_text, _idx) => ({
			Line: _idx + 1,
			Change: Num(changeList[_idx] ?? "", 0),
			Text: _text,
		}));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 리비전 범위 diff를 구한다.
	// @param _path: 디포 경로
	// @param _from: 시작 리비전
	// @param _to: 끝 리비전
	// @param _signal: 취소 신호
	public async Diff2(_path: string, _from: number, _to: number, _signal?: AbortSignal): Promise<string>
	{
		const result = await this.exec_.Exec("p4", ["diff2", `${_path}#${_from}`, `${_path}#${_to}`], this.Opts(_signal));
		if (result.Code !== 0)
			throw new P4Error("CommandFailed", `p4 diff2 실패 (${result.Code})`, result.Stderr);
		return result.Stdout;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 로그인 여부를 본다.
	// @param _signal: 취소 신호
	public async LoginStatus(_signal?: AbortSignal): Promise<boolean>
	{
		try
		{
			await this.RunAsync(["login", "-s"], _signal);
			return true;
		}
		catch (_e)
		{
			if (_e instanceof P4Error && _e.Kind === "NotLoggedIn")
				return false;
			throw _e;
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// p4 1건을 실행하고 ztag로 푼다.
	// @param _args: 인자
	// @param _signal: 취소 신호
	private async RunAsync(_args: string[], _signal?: AbortSignal): Promise<ZtagRecord[]>
	{
		const result = await this.exec_.Exec("p4", ["-ztag", ..._args], this.Opts(_signal));
		if (result.Code !== 0)
		{
			if (/Perforce password .* invalid|not logged in|Please login/i.test(result.Stderr))
				throw new P4Error("NotLoggedIn", "p4 login이 필요합니다.", result.Stderr);
			throw new P4Error("CommandFailed", `p4 ${_args[0] ?? ""} 실패 (${result.Code})`, result.Stderr);
		}
		return ZtagParser.Parse(result.Stdout);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 옵션을 만든다. 문자셋 강제 + 설정 주입.
	// @param _signal: 취소 신호
	private Opts(_signal?: AbortSignal): { TimeoutMs: number; Env: Record<string, string>; MaxOutputBytes: number; Signal?: AbortSignal }
	{
		const env: Record<string, string> = {};
		if (this.settings_.Charset.length > 0)
			env["P4CHARSET"] = this.settings_.Charset;
		if (this.settings_.Port.length > 0)
			env["P4PORT"] = this.settings_.Port;
		if (this.settings_.User.length > 0)
			env["P4USER"] = this.settings_.User;
		if (this.settings_.Client.length > 0)
			env["P4CLIENT"] = this.settings_.Client;
		const opts: { TimeoutMs: number; Env: Record<string, string>; MaxOutputBytes: number; Signal?: AbortSignal } = {
			TimeoutMs: kTimeoutMs, Env: env, MaxOutputBytes: kMaxOutputBytes,
		};
		if (_signal !== undefined)
			opts.Signal = _signal;
		return opts;
	}
}
