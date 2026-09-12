/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: 내비게이션 계약. Gui는 Electron을 모르므로 App이 주입한다.
*/

export interface INavigationService
{
	Navigate(_pluginId: string): void;
	Current: string | null;
	OpenExternal(_url: string): void;
}
