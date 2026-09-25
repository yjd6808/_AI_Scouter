/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: FunctionStore. SpeechFunctions.js를 읽어 함수 레지스트리로 컴파일.
	파일이 원본. 에디터 적용·외부 수정 모두 파일 경유. mtime 폴링은 엔진 담당.
*/

import { stat, readFile, writeFile, mkdir } from "node:fs/promises";
import * as path from "node:path";
import * as vm from "node:vm";
import type { ITriggerMapping } from "./Types";

export interface IFunctionApi
{
	SendText(_text: string): void;
	ClearText(): void;
	Log(_msg: string): void;
	Alert(_text: string): Promise<unknown>;
	Exec(_cmd: string, _args: string[]): Promise<{ Code: number; Stdout: string; Stderr: string }>;
}

export type FunctionTable = Record<string, (_api: IFunctionApi, _ctx: { Text: string }) => unknown>;

const kDefaultSource = `// SpeechExecutor 함수 파일. 이 파일이 원본이다.
// function 이름(api, ctx) 형태로 작성. ctx.Text = 매칭된 발화.
// 에디터 적용·직접 수정 모두 이 파일을 경유한다.

function clearText(api, ctx)
{
	api.ClearText();
	api.Log("텍스트 비움: " + ctx.Text);
}

async function execute(api, ctx)
{
	api.Log("실행 트리거: " + ctx.Text);
}

async function hello(api, ctx)
{
	await api.Alert("Hello World: " + ctx.Text);
}
`;

export class FunctionStore
{
	// ==================== 멤버 ====================
	private dir_ = "";
	private file_ = "";
	private mtimeMs_ = 0;
	private table_: FunctionTable = {};
	private mappings_: ITriggerMapping[] = [];

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장 폴더를 준비하고 기본 파일을 씨딩한다.
	// @param _storageDir: 저장 폴더
	public async InitAsync(_storageDir: string): Promise<void>
	{
		this.dir_ = _storageDir;
		this.file_ = path.join(_storageDir, "SpeechFunctions.js");
		await mkdir(_storageDir, { recursive: true });
		try
		{
			await stat(this.file_);
		}
		catch
		{
			await writeFile(this.file_, kDefaultSource, "utf-8");
		}
		const loaded = await this.LoadFromFileAsync();
		if (!loaded.Ok)
			throw new Error(loaded.Error);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 경로.
	public FilePath(): string
	{
		return this.file_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 현재 mtime.
	public async MtimeAsync(): Promise<number>
	{
		try
		{
			const st = await stat(this.file_);
			return st.mtimeMs;
		}
		catch
		{
			return 0;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 마지막 로드 mtime.
	public LoadedMtime(): number
	{
		return this.mtimeMs_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 원문을 읽는다.
	public async ReadSourceAsync(): Promise<string>
	{
		return readFile(this.file_, "utf-8");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 원문을 파일에 쓰고 재컴파일한다.
	// @param _source: 원문
	public async ApplySourceAsync(_source: string): Promise<{ Ok: boolean; Error: string; Funcs: string[] }>
	{
		await writeFile(this.file_, _source, "utf-8");
		return this.LoadFromFileAsync();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일에서 읽어 컴파일한다.
	public async LoadFromFileAsync(): Promise<{ Ok: boolean; Error: string; Funcs: string[] }>
	{
		let source = "";
		try
		{
			source = await readFile(this.file_, "utf-8");
			this.mtimeMs_ = await this.MtimeAsync();
		}
		catch (_e)
		{
			const msg = _e instanceof Error ? _e.message : String(_e);
			return { Ok: false, Error: msg, Funcs: [] };
		}
		return this.Compile(source);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 원문을 컴파일해 레지스트리를 교체한다.
	// @param _source: 원문
	public Compile(_source: string): { Ok: boolean; Error: string; Funcs: string[] }
	{
		const names = this.ExtractNames(_source);
		if (names.length === 0)
		{
			return { Ok: false, Error: "함수가 없음 (function 이름() 형태 필요)", Funcs: [] };
		}
		try
		{
			// vm.Script는 프로그램 스코프라 return 불가 → IIFE로 감싼다.
			const script = new vm.Script(`(function(){\n${_source}\nreturn { ${names.join(", ")} };\n})()`);
			const table = script.runInNewContext({}) as FunctionTable;
			for (let idx = 0; idx < names.length; idx++)
			{
				const name = names[idx];
				if (name === undefined || typeof table[name] !== "function")
					return { Ok: false, Error: `함수 아님: ${name ?? "?"}`, Funcs: [] };
			}
			this.table_ = table;
			return { Ok: true, Error: "", Funcs: names };
		}
		catch (_e)
		{
			const msg = _e instanceof Error ? _e.message : String(_e);
			return { Ok: false, Error: msg, Funcs: [] };
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록된 함수명으로 실행한다. 동기 throw는 거부로 바꾼다.
	// @param _name: 함수명
	// @param _api: API
	// @param _text: 매칭 발화
	public RunAsync(_name: string, _api: IFunctionApi, _text: string): Promise<unknown>
	{
		const fn = this.table_[_name];
		if (typeof fn !== "function")
			return Promise.reject(new Error(`함수 없음: ${_name}`));
		try
		{
			return Promise.resolve(fn(_api, { Text: _text }));
		}
		catch (_e)
		{
			return Promise.reject(_e instanceof Error ? _e : new Error(String(_e)));
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 등록된 함수명 목록.
	public FuncNames(): string[]
	{
		return Object.keys(this.table_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 매핑 목록을 읽는다.
	public Mappings(): ITriggerMapping[]
	{
		return this.mappings_.map((_m) => ({ Text: _m.Text, Func: _m.Func }));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 매핑 목록을 교체한다.
	// @param _mappings: 매핑
	public SetMappings(_mappings: ITriggerMapping[]): void
	{
		this.mappings_ = _mappings.map((_m) => ({ Text: _m.Text, Func: _m.Func }));
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// function 이름들을 추출한다.
	// @param _source: 원문
	private ExtractNames(_source: string): string[]
	{
		const names: string[] = [];
		const re = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(_source)) !== null)
		{
			const name = m[1];
			if (name !== undefined && !names.includes(name))
				names.push(name);
		}
		return names;
	}
}
