/*
	작성자: Scouter
	생성일: 2026-09-24
	=====
	설명: KeyStore. provider별 복수 API 키 + 사용 중 지정.
	StorageDir/keys.json에 직접 기록한다 (플랫폼 Storage는 Load/Flush 호출이
	없어 재시작 시 유실되므로). 형식은 WPF api_key.json과 동일:
	{ "keys": [{id,name,provider,apiKey}], "active": {provider: id} }
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { IPluginContext } from "@scouter/plugin-api";
import type { IKeyEntry } from "./Types";

interface IKeyFile
{
	keys?: IKeyEntry[];
	active?: Record<string, string>;
}

export class KeyStore
{
	// ==================== 멤버 ====================
	private file_ = "";
	private keys_: IKeyEntry[] = [];
	private active_: Record<string, string> = {};

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 저장 파일을 묶는다. 없으면 플랫폼 저장소에서 1회 이전한다.
	// @param _ctx: 컨텍스트
	// @param _storageDir: 저장 폴더
	public Bind(_ctx: IPluginContext, _storageDir: string): void
	{
		this.file_ = path.join(_storageDir, "keys.json");
		if (!this.LoadFile())
			this.MigrateFromStorage(_ctx);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전체 목록을 반환한다.
	// @param _provider: 제공자
	public List(_provider: string): IKeyEntry[]
	{
		return this.keys_.filter((_k) => _k.Provider === _provider);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용 중 키 값을 반환한다. 없으면 "".
	// @param _provider: 제공자
	public ActiveKey(_provider: string): string
	{
		const id = this.active_[_provider] ?? "";
		const hit = this.keys_.find((_k) => _k.Id === id && _k.Provider === _provider);
		if (hit !== undefined)
			return hit.ApiKey;
		const first = this.keys_.find((_k) => _k.Provider === _provider);
		return first?.ApiKey ?? "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용 중 키 id를 반환한다.
	// @param _provider: 제공자
	public ActiveId(_provider: string): string
	{
		return this.active_[_provider] ?? "";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키를 추가한다.
	// 적용(사용 중 지정)은 바꾸지 않는다. 호출 측에서 명시 적용.
	// @param _provider: 제공자
	// @param _name: 이름
	// @param _key: 키
	public Add(_provider: string, _name: string, _key: string): IKeyEntry
	{
		const entry: IKeyEntry =
		{
			Id: Math.random().toString(36).slice(2) + Date.now().toString(36),
			Name: _name.trim().length > 0 ? _name.trim() : "새 키",
			Provider: _provider,
			ApiKey: _key,
		};
		this.keys_.push(entry);
		this.Save();
		return entry;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키를 삭제한다.
	// @param _id: 키 id
	public Delete(_id: string): void
	{
		const at = this.keys_.findIndex((_k) => _k.Id === _id);
		if (at < 0)
			return;
		const removed = this.keys_[at];
		if (removed === undefined)
			return;
		const provider = removed.Provider;
		this.keys_.splice(at, 1);
		if (this.active_[provider] === _id)
		{
			const next = this.keys_.find((_k) => _k.Provider === provider);
			if (next !== undefined)
				this.active_[provider] = next.Id;
			else
				Reflect.deleteProperty(this.active_, provider);
		}
		this.Save();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 사용 중 키를 지정한다.
	// @param _provider: 제공자
	// @param _id: 키 id
	public Apply(_provider: string, _id: string): void
	{
		this.active_[_provider] = _id;
		this.Save();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 이름·키 수정을 반영한다.
	// @param _id: 키 id
	// @param _name: 이름
	// @param _key: 키
	public Update(_id: string, _name: string, _key: string): void
	{
		const hit = this.keys_.find((_k) => _k.Id === _id);
		if (hit === undefined)
			return;
		hit.Name = _name;
		hit.ApiKey = _key;
		this.Save();
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일에서 읽는다. 성공 여부 반환.
	private LoadFile(): boolean
	{
		if (this.file_.length === 0 || !existsSync(this.file_))
			return false;
		try
		{
			const file = JSON.parse(readFileSync(this.file_, "utf-8")) as Partial<IKeyFile>;
			if (!Array.isArray(file.keys))
				return false;
			this.keys_ = file.keys;
			const active: unknown = file.active;
			if (active !== null && typeof active === "object" && !Array.isArray(active))
				this.active_ = active as Record<string, string>;
			return true;
		}
		catch
		{
			return false;
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 플랫폼 저장소 값을 1회 가져온다.
	// @param _ctx: 컨텍스트
	private MigrateFromStorage(_ctx: IPluginContext): void
	{
		try
		{
			const raw = _ctx.Storage.Get<string>("keys.json", "");
			if (raw.length === 0)
				return;
			const file = JSON.parse(raw) as Partial<IKeyFile>;
			if (Array.isArray(file.keys) && file.keys.length > 0)
			{
				this.keys_ = file.keys;
				const active: unknown = file.active;
				if (active !== null && typeof active === "object" && !Array.isArray(active))
					this.active_ = active as Record<string, string>;
				this.Save();
			}
		}
		catch
		{
			// 무시.
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일에 즉시 기록한다.
	private Save(): void
	{
		if (this.file_.length === 0)
			return;
		try
		{
			mkdirSync(path.dirname(this.file_), { recursive: true });
			writeFileSync(this.file_, JSON.stringify({ keys: this.keys_, active: this.active_ }, null, 2), "utf-8");
		}
		catch
		{
			// 무시.
		}
	}
}
