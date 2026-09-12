/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: ITool. MCP Tool 1개 계약.
*/

export interface IToolCall
{
	SessionId: string;
	Progress(_n: number, _msg: string): void;
	Signal: AbortSignal;
	Log(_msg: string): void;
}

export interface IToolAnnotations
{
	ReadOnly?: boolean;
	Destructive?: boolean;
}

export interface ITool
{
	Name: string;
	Description: string;
	InputSchema: Record<string, unknown>;
	Annotations?: IToolAnnotations;
	DefaultApproval?: "auto" | "ask" | "deny";
	Run(_args: Record<string, unknown>, _call: IToolCall): Promise<unknown>;
}
