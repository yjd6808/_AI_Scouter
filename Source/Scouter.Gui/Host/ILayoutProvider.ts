/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 레이아웃 제공자 계약. UIManager는 이름 → XML 문자열만 요청한다.
*/

export interface ILayoutProvider
{
	Resolve(_name: string): Promise<string | null>;
	PathOf(_name: string): string | null;
	NameOf(_path: string): string | null;
	WatchDirs(): string[];
}
