/*
	작성자: 윤정도
	생성일: 2026-09-12
	=====
	설명: AutoStart. 로그인 자동 실행 조회·설정.
*/

export interface ILoginSettings
{
	SetLoginItemSettings(_opts: { openAtLogin: boolean; args: string[] }): void;
	GetLoginItemSettings(): { openAtLogin: boolean };
}

export class AutoStart
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 자동 실행을 켜고 끈다. --hidden으로 시작한다.
	// @param _app: 앱 설정 인터페이스
	// @param _enabled: 켜기 여부
	public static Set(_app: ILoginSettings, _enabled: boolean): void
	{
		_app.SetLoginItemSettings({ openAtLogin: _enabled, args: ["--hidden"] });
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 자동 실행 여부를 본다.
	// @param _app: 앱 설정 인터페이스
	public static Get(_app: ILoginSettings): boolean
	{
		return _app.GetLoginItemSettings().openAtLogin;
	}
}
