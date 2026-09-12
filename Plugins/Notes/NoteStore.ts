/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: NoteStore. notes/*.md 읽기·쓰기·추가·검색.
*/

import type { INoteFile, INoteInfo } from "./Types";

//////////////////////////////////////////////////////////////////////////////////////
// 제목을 파일명으로 굳힌다. 경로 탈출은 throw.
// @param _name: 노트 이름
export function Slugify(_name: string): string
{
	const slug = _name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
	if (slug.length === 0 || slug === "." || slug === "..")
		throw new Error(`노트 이름 오류: ${_name}`);
	return slug;
}

export class NoteStore
{
	// ==================== 멤버 ====================
	private readonly fs_: INoteFile;
	private readonly dir_: string;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 인터페이스와 폴더로 만든다.
	// @param _fs: 파일 인터페이스(ctx.Fs)
	// @param _dir: notes 폴더
	public constructor(_fs: INoteFile, _dir: string)
	{
		this.fs_ = _fs;
		this.dir_ = _dir;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 노트 목록을 이름순으로 돌려준다.
	public async ListAsync(): Promise<INoteInfo[]>
	{
		let names: string[] = [];
		try
		{
			names = await this.fs_.ReadDir(this.dir_);
		}
		catch
		{
			return [];
		}
		const out: INoteInfo[] = [];
		for (const name of names.filter((_n) => _n.endsWith(".md")).sort())
		{
			const text = await this.ReadAsync(name.slice(0, -".md".length)).catch(() => null);
			if (text === null)
				continue;
			out.push({ Name: name.slice(0, -".md".length), Size: text.length, UpdatedAt: 0 });
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 노트 전문을 읽는다. 없으면 "".
	// @param _name: 노트 이름
	public async ReadAsync(_name: string): Promise<string>
	{
		const file = this.PathOf(_name);
		if (!await this.fs_.Exists(file))
			return "";
		return this.fs_.ReadText(file);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 노트를 통째로 쓴다.
	// @param _name: 노트 이름
	// @param _text: 전문
	public async WriteAsync(_name: string, _text: string): Promise<void>
	{
		await this.fs_.WriteText(this.PathOf(_name), _text);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 끝에 타임스탬프 항목을 덧붙인다. 파일이 없으면 만든다.
	// @param _name: 노트 이름
	// @param _text: 항목 본문
	public async AppendAsync(_name: string, _text: string): Promise<void>
	{
		const prev = await this.ReadAsync(_name);
		const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
		const line = `- [${stamp}] ${_text.replace(/\r?\n/g, " ")}`;
		const next = prev.length > 0 && !prev.endsWith("\n") ? `${prev}\n${line}\n` : `${prev}${line}\n`;
		await this.WriteAsync(_name, next);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 노트에서 본문을 찾는다. 대소문자 무시.
	// @param _query: 검색어
	public async SearchAsync(_query: string): Promise<Array<{ Note: string; Line: number; Text: string }>>
	{
		const out: Array<{ Note: string; Line: number; Text: string }> = [];
		const lowered = _query.toLowerCase();
		if (lowered.length === 0)
			return out;
		for (const info of await this.ListAsync())
		{
			const lines = (await this.ReadAsync(info.Name)).split("\n");
			for (let idx = 0; idx < lines.length; ++idx)
			{
				const line = lines[idx] as string;
				if (line.toLowerCase().includes(lowered))
					out.push({ Note: info.Name, Line: idx + 1, Text: line.slice(0, 200) });
			}
		}
		return out;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름을 파일 경로로 굳힌다.
	// @param _name: 노트 이름
	private PathOf(_name: string): string
	{
		return `${this.dir_}/${Slugify(_name)}.md`;
	}
}
