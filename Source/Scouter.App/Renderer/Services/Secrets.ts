/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Secrets. safeStorage 암호화 파일. 불가하면 명확한 에러.
*/

import { promises as fs } from "node:fs";

interface ISafeStorage
{
	isEncryptionAvailable(): boolean;
	encryptString(_plain: string): Buffer;
	decryptString(_buffer: Buffer): string;
}

function SafeStorage(): ISafeStorage
{
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const electron = require("electron") as { safeStorage?: ISafeStorage };
	if (electron.safeStorage === undefined)
		throw new Error("[Secrets] safeStorage 없음");
	return electron.safeStorage;
}

export class Secrets
{
	// ==================== 정적 ====================
	private static s_file_ = "";
	private static s_cache_: Map<string, string> | null = null;

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 경로를 정한다.
	// @param _file: secrets.bin 경로
	public static Init(_file: string): void
	{
		Secrets.s_file_ = _file;
		Secrets.s_cache_ = null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다. 없으면 null.
	// @param _key: 키
	public static async GetAsync(_key: string): Promise<string | null>
	{
		const map = await Secrets.LoadAsync();
		return map.get(_key) ?? null;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓴다.
	// @param _key: 키
	// @param _value: 값
	public static async SetAsync(_key: string, _value: string): Promise<void>
	{
		const map = await Secrets.LoadAsync();
		map.set(_key, _value);
		await Secrets.SaveAsync(map);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 지운다.
	// @param _key: 키
	public static async DeleteAsync(_key: string): Promise<void>
	{
		const map = await Secrets.LoadAsync();
		map.delete(_key);
		await Secrets.SaveAsync(map);
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 복호화 로드. 암호화 불가면 throw.
	private static async LoadAsync(): Promise<Map<string, string>>
	{
		if (Secrets.s_cache_ !== null)
			return Secrets.s_cache_;
		const storage = SafeStorage();
		if (!storage.isEncryptionAvailable())
			throw new Error("[Secrets] 암호화 불가 환경");
		try
		{
			const raw = await fs.readFile(Secrets.s_file_);
			const json = storage.decryptString(raw);
			Secrets.s_cache_ = new Map(Object.entries(JSON.parse(json) as Record<string, string>));
		}
		catch
		{
			Secrets.s_cache_ = new Map();
		}
		return Secrets.s_cache_;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 암호화 저장.
	// @param _map: 값
	private static async SaveAsync(_map: Map<string, string>): Promise<void>
	{
		const storage = SafeStorage();
		const json = JSON.stringify(Object.fromEntries(_map));
		await fs.writeFile(Secrets.s_file_, storage.encryptString(json));
	}
}
