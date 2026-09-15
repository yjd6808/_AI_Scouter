/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Settings. ajv 검증 + 원자 저장 + Changed 즉시.
*/

import { promises as fs } from "node:fs";
import Ajv from "ajv";
import type { ValidateFunction } from "ajv";
import { SimpleEvent } from "@scouter/gui";

export interface ISettingsChange
{
	Key: string;
	OldValue: unknown;
	NewValue: unknown;
}

export class Settings
{
	// ==================== 정적 ====================
	private static s_data_: Record<string, unknown> = {};
	private static s_schema_: Record<string, unknown> = {};
	private static s_validate_: ValidateFunction | null = null;
	private static s_file_ = "";
	private static s_timer_: ReturnType<typeof setTimeout> | null = null;
	private static readonly s_changed_ = new SimpleEvent<ISettingsChange>();

	// ==================== 속성 ====================
	public static get Changed(): SimpleEvent<ISettingsChange> { return Settings.s_changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일을 읽고 스키마·기본값을 입힌다.
	// @param _file: settings.json 경로
	// @param _schema: JSON 스키마
	// @param _defaults: 기본값
	public static async Load(_file: string, _schema: Record<string, unknown>, _defaults: Record<string, unknown>): Promise<void>
	{
		Settings.s_file_ = _file;
		Settings.s_schema_ = _schema;
		const ajv = new Ajv({ allErrors: true, useDefaults: true });
		Settings.s_validate_ = ajv.compile(_schema);
		let loaded: Record<string, unknown> = {};
		try
		{
			loaded = JSON.parse(await fs.readFile(_file, "utf-8")) as Record<string, unknown>;
		}
		catch
		{
			loaded = {};
		}
		Settings.s_data_ = Settings.Merge(_defaults, loaded);
		Settings.MigrateThemeScheme();
		if (!Settings.s_validate_(Settings.s_data_))
			Settings.s_data_ = Settings.Merge(_defaults, {});
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 읽는다. 없으면 기본값, 그래도 없으면 throw.
	// @param _key: PascalCase 점 표기
	// @param _def: 기본값
	public static Get<T>(_key: string, _def?: T): T
	{
		const found = Settings.At(_key);
		if (found === undefined)
		{
			if (_def !== undefined)
				return _def;
			throw new Error(`[Settings] 미정의 키: ${_key}`);
		}
		return found as T;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 값을 쓴다. 검증→저장→Changed 즉시, 파일은 300ms 디바운스.
	// @param _key: 키
	// @param _value: 값
	public static Set(_key: string, _value: unknown): void
	{
		const old = Settings.At(_key);
		Settings.Put(_key, _value);
		const validate = Settings.s_validate_;
		if (validate && !validate(Settings.s_data_))
		{
			Settings.Put(_key, old);
			throw new Error(`[Settings] 검증 실패: ${_key}`);
		}
		Settings.s_changed_.Invoke({ Key: _key, OldValue: old, NewValue: _value });
		Settings.ScheduleSave();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 대기 중인 저장을 즉시 쓴다. 종료 직전 플러시용.
	public static async FlushAsync(): Promise<void>
	{
		if (Settings.s_timer_ !== null)
		{
			clearTimeout(Settings.s_timer_);
			Settings.s_timer_ = null;
		}
		await Settings.SaveAsync();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 키를 기본값으로 되돌린다. 키 생략 시 전체.
	// @param _key: 키
	public static Reset(_key?: string): void
	{
		if (_key === undefined)
		{
			Settings.s_data_ = {};
			Settings.ScheduleSave();
			return;
		}
		const parts = _key.split(".");
		let node = Settings.s_data_;
		for (let idx = 0; idx < parts.length - 1; ++idx)
		{
			const next = node[parts[idx] as string];
			if (typeof next !== "object" || next === null)
				return;
			node = next as Record<string, unknown>;
		}
		Reflect.deleteProperty(node, parts[parts.length - 1] as string);
		Settings.ScheduleSave();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 선언 여부를 본다.
	// @param _key: 키
	public static Has(_key: string): boolean
	{
		return Settings.At(_key) !== undefined;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// Plugin 스키마를 접두에 등록한다. P6에서 사용.
	// @param _prefix: 접두 (Plugins.{Id})
	// @param _schema: 스키마
	public static RegisterSchema(_prefix: string, _schema: Record<string, unknown>): void
	{
		(Settings.s_schema_["properties"] as Record<string, unknown>)[_prefix] = _schema;
	}

	// ==================== 내부 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 구 Theme.Scheme="System" 저장값을 Dark로 옮긴다. 스키마에서 System을 빼도 기존 설정이 날아가지 않게 한다.
	private static MigrateThemeScheme(): void
	{
		const theme = Settings.s_data_["Theme"];
		if (typeof theme !== "object" || theme === null)
			return;
		const record = theme as Record<string, unknown>;
		if (record["Scheme"] === "System")
			record["Scheme"] = "Dark";
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 점 경로로 읽는다.
	// @param _key: 키
	private static At(_key: string): unknown
	{
		let node: unknown = Settings.s_data_;
		for (const part of _key.split("."))
		{
			if (typeof node !== "object" || node === null)
				return undefined;
			node = (node as Record<string, unknown>)[part];
		}
		return node;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 점 경로로 쓴다. 중간은 자동 생성.
	// @param _key: 키
	// @param _value: 값
	private static Put(_key: string, _value: unknown): void
	{
		const parts = _key.split(".");
		let node = Settings.s_data_;
		for (let idx = 0; idx < parts.length - 1; ++idx)
		{
			const part = parts[idx] as string;
			const next = node[part];
			if (typeof next !== "object" || next === null)
				node[part] = {};
			node = node[part] as Record<string, unknown>;
		}
		node[parts[parts.length - 1] as string] = _value;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 기본값 위에 덮는다. 깊은 병합 1단계.
	// @param _defaults: 기본값
	// @param _loaded: 파일값
	private static Merge(_defaults: Record<string, unknown>, _loaded: Record<string, unknown>): Record<string, unknown>
	{
		const out: Record<string, unknown> = JSON.parse(JSON.stringify(_defaults)) as Record<string, unknown>;
		for (const [key, value] of Object.entries(_loaded))
		{
			if (typeof value === "object" && value !== null && typeof out[key] === "object" && out[key] !== null)
				out[key] = { ...(out[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
			else
				out[key] = value;
		}
		return out;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 300ms 디바운스 저장. .tmp→rename 원자 쓰기.
	private static ScheduleSave(): void
	{
		if (Settings.s_timer_ !== null)
			clearTimeout(Settings.s_timer_);
		Settings.s_timer_ = setTimeout(() =>
		{
			Settings.s_timer_ = null;
			void Settings.SaveAsync();
		}, 300);
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 파일에 쓴다.
	private static async SaveAsync(): Promise<void>
	{
		if (Settings.s_file_.length === 0)
			return;
		try
		{
			const text = JSON.stringify(Settings.s_data_, null, 2);
			await fs.writeFile(`${Settings.s_file_}.tmp`, text, "utf-8");
			await fs.rename(`${Settings.s_file_}.tmp`, Settings.s_file_);
		}
		catch
		{
			// 저장 실패는 무시(다음 변경에 재시도).
		}
	}
}
