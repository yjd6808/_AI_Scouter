/*
	작성자: 윤정도
	생성일: 2026-09-17
	=====
	설명: ForegroundPolicy. 주 창을 지금 앞으로 끌어올려도 되는지 정하는 순수 규칙. electron 의존 없음.
*/

export class ForegroundPolicy
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// Foreground 처리를 지금 해야 하는지 판정한다. 부수효과 없는 순수 함수.
	// --test는 E2E가 창 z-order·포커스를 잡고 있어 가로채면 흔들리므로 무조건 건너뛴다.
	// @param _requested: 호출 쪽이 원했는지(전역 확인창의 FocusMain 옵션 등)
	// @param _testMode: --test 실행인지
	public static ShouldBringToFront(_requested: boolean, _testMode: boolean): boolean
	{
		return _requested && !_testMode;
	}
}
