/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Storage. Plugin별 JSON 파일 + 300ms 디바운스.
*/

import { promises as fs } from "node:fs";
import * as path from "node:path";

export class Storage
{
	// ==================== 멤버 ====================
	private readonly file_: string;
	private data_: Record<string, unknown> = {};
	private timer_: ReturnType<typeof setTimeout> | null = null;
	private loaded_ = false;

	// ==================== 생성 · 소멸 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일 경로로 만든다.
	// @param _file: storage.json 경로
	public constructor(_file: string)
	{
		this.file_ = _file;
	}

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일을 읽는다. 없으면 빈 상태.
	public async LoadAsync(): Promise<void>
	{
		try
		{
			this.data_ = JSON.parse(await fs.readFile(this.file_, "utf-8")) as Record<string, unknown>;
		}
		catch
		{
			this.data_ = {};
		}
		this.loaded_ = true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다.
	// @param _key: 키
	// @param _def: 기본값
	public Get<T>(_key: string, _def: T): T
	{
		const found = this.data_[_key];
		return (found === undefined ? _def : found) as T;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓰고 저장을 예약한다.
	// @param _key: 키
	// @param _value: 값
	public Set(_key: string, _value: unknown): void
	{
		this.data_[_key] = _value;
		this.ScheduleSave();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키를 지운다.
	// @param _key: 키
	public Delete(_key: string): void
	{
		Reflect.deleteProperty(this.data_, _key);
		this.ScheduleSave();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 키를 반환한다.
	public Keys(): string[]
	{
		return Object.keys(this.data_);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 즉시 쓴다. 종료 시 호출.
	public async FlushAsync(): Promise<void>
	{
		if (this.timer_ !== null)
		{
			clearTimeout(this.timer_);
			this.timer_ = null;
		}
		if (!this.loaded_)
			return;
		try
		{
			await fs.mkdir(path.dirname(this.file_), { recursive: true });
			await fs.writeFile(this.file_, JSON.stringify(this.data_, null, 2), "utf-8");
		}
		catch
		{
			// 무시.
		}
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 300ms 디바운스 저장.
	private ScheduleSave(): void
	{
		if (this.timer_ !== null)
			clearTimeout(this.timer_);
		this.timer_ = setTimeout(() =>
		{
			this.timer_ = null;
			void this.FlushAsync();
		}, 300);
	}
}
