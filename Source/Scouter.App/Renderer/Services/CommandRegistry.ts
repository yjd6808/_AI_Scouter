/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: CommandRegistry. {Owner}.{Name} 명령 등록·실행.
*/

import { SimpleEvent } from "@scouter/gui";
import type { IDisposable } from "@scouter/gui";

export interface ICommandDef
{
	Id: string;
	Title: string;
	Category: string;
	Hotkey?: string;
	Icon?: string;
	Execute(_param?: unknown): void | Promise<void>;
	CanExecute?(): boolean;
}

export class CommandRegistry
{
	// ==================== 정적 ====================
	private static readonly s_commands_ = new Map<string, ICommandDef>();
	private static readonly s_changed_ = new SimpleEvent<void>();

	// ==================== 속성 ====================
	public static get Changed(): SimpleEvent<void> { return CommandRegistry.s_changed_; }

	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 명령을 등록한다. 중복 Id면 throw.
	// @param _def: 정의
	public static Register(_def: ICommandDef): IDisposable
	{
		if (CommandRegistry.s_commands_.has(_def.Id))
			throw new Error(`[CommandRegistry] 중복 등록: ${_def.Id}`);
		CommandRegistry.s_commands_.set(_def.Id, _def);
		CommandRegistry.s_changed_.Invoke(undefined);
		let removed = false;
		return {
			Dispose: () =>
			{
				if (removed)
					return;
				removed = true;
				CommandRegistry.s_commands_.delete(_def.Id);
				CommandRegistry.s_changed_.Invoke(undefined);
			},
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행 가능 여부를 본다. 미등록이면 false.
	// @param _id: 명령 Id
	public static CanExecute(_id: string): boolean
	{
		const def = CommandRegistry.s_commands_.get(_id);
		if (def === undefined)
			return false;
		return def.CanExecute?.() ?? true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 실행한다. CanExecute false면 false 반환.
	// @param _id: 명령 Id
	// @param _param: 파라미터
	public static async Execute(_id: string, _param?: unknown): Promise<boolean>
	{
		const def = CommandRegistry.s_commands_.get(_id);
		if (def === undefined)
			return false;
		if (def.CanExecute !== undefined && !def.CanExecute())
			return false;
		await def.Execute(_param);
		return true;
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 전 목록을 반환한다. 팔레트용.
	public static List(): ICommandDef[]
	{
		return [...CommandRegistry.s_commands_.values()];
	}
}
