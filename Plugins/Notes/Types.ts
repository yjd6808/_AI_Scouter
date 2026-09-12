/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: Notes 공용 타입. 노트 정보·파일 인터페이스.
*/

export interface INoteInfo
{
	Name: string;
	Size: number;
	UpdatedAt: number;
}

export interface INoteFile
{
	ReadText(_path: string): Promise<string>;
	WriteText(_path: string, _text: string): Promise<void>;
	ReadDir(_path: string): Promise<string[]>;
	Exists(_path: string): Promise<boolean>;
}

export interface INoteSettings
{
	DefaultNote: string;
}
