/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 로드 문맥. 설정·테마·이름표·대기 바인딩을 한데 모은다.
*/

import type { UIElement } from "../Core/UIElement";
import type { Window } from "../Host/Window";
import type { UserControl } from "../Host/UserControl";
import type { DataList } from "./DataList";
import type { IParsedBinding } from "./Expression/Ast";
import type { UIProperty } from "../Core/UIProperty";
import type { BindingGraph } from "./BindingGraph";

export interface ISettingsSource
{
	Get(_path: string): unknown;
	Subscribe(_path: string, _handler: () => void): { Dispose(): void };
}

export interface IThemeSource
{
	Token(_token: string): string;
}

export interface ICommandSource
{
	Execute(_id: string, _param?: string): void;
	Has(_id: string): boolean;
}

export interface IPendingBinding
{
	Target: UIElement;
	Property: UIProperty<unknown>;
	Parsed: IParsedBinding;
	Raw: string;
}

export interface ILintMessage
{
	Code: string;
	Line: number;
	Column: number;
	Text: string;
}

export class LoadContext
{
	// ==================== 멤버 ====================
	public Settings: ISettingsSource | null = null;
	public Theme: IThemeSource | null = null;
	public readonly Env = new Map<string, string>();
	public Handlers: object = {};
	public Commands: ICommandSource | null = null;
	public Owner: Window | UserControl | null = null;
	public Data: DataList | null = null;
	public readonly Names = new Map<string, UIElement>();
	public readonly Pending: IPendingBinding[] = [];
	public readonly Warnings: ILintMessage[] = [];
	public Graph: BindingGraph | null = null;
}
