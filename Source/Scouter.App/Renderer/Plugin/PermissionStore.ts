/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: PermissionStore. 설치 1회 승인 기록.
*/

import { promises as fs } from "node:fs";
import * as path from "node:path";

interface IPermissionEntry
{
	Granted: string[];
	At: string;
	Version: string;
}

export class PermissionStore
{
	// ==================== 멤버 ====================
	private readonly file_: string;
	private cache_: Record<string, IPermissionEntry> = {};
	private loaded_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 경로로 만든다.
	// @param _file: permissions.json 경로
	public constructor(_file: string)
	{
		this.file_ = _file;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 승인된 목록을 반환한다. 버전 달라도 목록은 유지(추가분만 재질문).
	// @param _id: Plugin Id
	public async Granted(_id: string): Promise<string[]>
	{
		await this.Ensure();
		return [...(this.cache_[_id]?.Granted ?? [])];
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 권한이 승인됐는지 본다.
	// @param _id: Plugin Id
	// @param _perms: 요구 권한
	public async IsGranted(_id: string, _perms: string[]): Promise<boolean>
	{
		const granted = await this.Granted(_id);
		return _perms.every((_p) => granted.includes(_p));
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 승인 내역을 저장한다.
	// @param _id: Plugin Id
	// @param _perms: 승인 권한
	// @param _version: Manifest 버전
	public async GrantAsync(_id: string, _perms: string[], _version: string): Promise<void>
	{
		await this.Ensure();
		this.cache_[_id] = { Granted: [..._perms], At: new Date().toISOString(), Version: _version };
		try
		{
			await fs.mkdir(path.dirname(this.file_), { recursive: true });
			await fs.writeFile(this.file_, JSON.stringify(this.cache_, null, 2), "utf-8");
		}
		catch
		{
			// 무시.
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 지연 로드 1회.
	private async Ensure(): Promise<void>
	{
		if (this.loaded_)
			return;
		this.loaded_ = true;
		try
		{
			this.cache_ = JSON.parse(await fs.readFile(this.file_, "utf-8")) as Record<string, IPermissionEntry>;
		}
		catch
		{
			this.cache_ = {};
		}
	}
}
