/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: FsLayoutProvider. --layout-dir → ~/.scouter/layouts → dist → PluginDir 순으로 찾는다.
*/

import * as path from "node:path";
import { promises as fs } from "node:fs";
import type { ILayoutProvider } from "@scouter/gui";

export interface IFsLayoutOptions
{
	LayoutDir: string | null;
	UserDir: string;
	DistDir: string;
	PluginDir: string | null;
	ExtraPluginRoots: string[];
}

export class FsLayoutProvider implements ILayoutProvider
{
	// ==================== 멤버 ====================
	private readonly opts_: IFsLayoutOptions;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 검색 경로를 받는다.
	// @param _opts: 옵션
	public constructor(_opts: IFsLayoutOptions)
	{
		this.opts_ = _opts;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름으로 XML을 읽는다. "P4Util/Main" → {dir}/P4Util/Main.xml.
	// @param _name: 창 이름
	public async Resolve(_name: string): Promise<string | null>
	{
		const found = await this.FindFile(_name);
		if (found === null)
			return null;
		return fs.readFile(found, "utf-8");
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 해석된 경로를 반환한다.
	// @param _name: 창 이름
	public PathOf(_name: string): string | null
	{
		return FsLayoutProvider.JoinFirst(this.Dirs(), _name);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 경로를 이름으로 되돌린다. 감시 폴더 아래만.
	// @param _path: 경로
	public NameOf(_path: string): string | null
	{
		const norm = path.normalize(_path);
		for (const dir of this.Dirs())
		{
			const rel = path.relative(dir, norm);
			if (rel.startsWith("..") || !rel.endsWith(".xml"))
				continue;
			const noExt = rel.slice(0, -".xml".length).split(path.sep).join("/");
			const parts = noExt.split("/");
			if (parts.length === 3 && parts[1] === "Layout")
				return `${parts[0] as string}/${parts[2] as string}`;
			return noExt;
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 감시 폴더 목록.
	public WatchDirs(): string[]
	{
		return this.Dirs();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 우선순위 경로 목록.
	private Dirs(): string[]
	{
		const out: string[] = [];
		if (this.opts_.LayoutDir !== null)
			out.push(path.resolve(this.opts_.LayoutDir));
		out.push(path.join(this.opts_.UserDir, "layouts"));
		out.push(path.resolve(this.opts_.DistDir, "Layout"));
		if (this.opts_.PluginDir !== null)
			out.push(path.join(path.resolve(this.opts_.PluginDir), "Layout"));
		for (const root of this.opts_.ExtraPluginRoots)
			out.push(path.resolve(root));
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 존재하는 첫 파일을 찾는다. Plugin 이름이면 Layout 서브폴더도 본다.
	// @param _name: 창 이름
	private async FindFile(_name: string): Promise<string | null>
	{
		for (const dir of this.Dirs())
		{
			const candidates = [path.join(dir, `${_name}.xml`)];
			const slash = _name.indexOf("/");
			if (slash > 0)
			{
				const plugin = _name.slice(0, slash);
				const rest = _name.slice(slash + 1);
				candidates.push(path.join(dir, plugin, "Layout", `${rest}.xml`));
			}
			for (const full of candidates)
			{
				try
				{
					await fs.access(full);
					return full;
				}
				catch
				{
					continue;
				}
			}
		}
		return null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 첫 후보 경로를 합친다. 존재 검사는 안 함.
	// @param _dirs: 폴더 목록
	// @param _name: 창 이름
	private static JoinFirst(_dirs: string[], _name: string): string | null
	{
		if (_dirs.length === 0)
			return null;
		return path.join(_dirs[0] as string, `${_name}.xml`);
	}
}
