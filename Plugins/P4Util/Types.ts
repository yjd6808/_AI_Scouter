/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: P4Util 공용 타입. ztag 레코드·파일·체인지 정보.
*/

export type ZtagRecord = Record<string, string | string[]>;

export interface IFileEntry
{
	DepotPath: string;
	Rev: number;
	Action: string;
	Change: number;
	Type: string;
}

export interface IChangeInfo
{
	Change: number;
	Date: string;
	User: string;
	Description: string;
}

export interface IDescribeInfo
{
	Change: number;
	User: string;
	Description: string;
	Files: IFileEntry[];
}

export interface IOpenedInfo
{
	DepotPath: string;
	Action: string;
	Change: number;
	Type: string;
}

export interface IAnnotateLine
{
	Line: number;
	Change: number;
	Text: string;
}

export interface IP4Exec
{
	Exec(_cmd: string, _args: string[], _opts?: { TimeoutMs?: number; Env?: Record<string, string>; MaxOutputBytes?: number; Signal?: AbortSignal }): Promise<{ Code: number; Stdout: string; Stderr: string }>;
}

export interface IP4Settings
{
	Port: string;
	User: string;
	Client: string;
	Charset: string;
	DescribeBatch: number;
	MaxChanges: number;
}

export interface IP4Runner
{
	readonly Settings: IP4Settings;
	Changes(_depot: string, _from: number, _to: number, _signal?: AbortSignal): Promise<IChangeInfo[]>;
	Describe(_changes: number[], _signal?: AbortSignal): Promise<IDescribeInfo[]>;
	Opened(_client: string, _signal?: AbortSignal): Promise<IOpenedInfo[]>;
	Annotate(_path: string, _signal?: AbortSignal): Promise<IAnnotateLine[]>;
	Diff2(_path: string, _from: number, _to: number, _signal?: AbortSignal): Promise<string>;
	LoginStatus(_signal?: AbortSignal): Promise<boolean>;
}
