/*
	작성자: 윤정도
	생성일: 2026-11-12
	=====
	설명: ScheduleProps. Register·Update Tool이 함께 쓰는 예약·인자 값 입력 스키마 조각.
	      두 Tool의 설명이 어긋나지 않도록 한곳에서 만든다.
*/

export class ScheduleProps
{
	// ==================== 공개 메서드 ====================

	//////////////////////////////////////////////////////////////////////////////////////
	// 예약 필드 스키마를 만든다. 객체 펼치기로 각 Tool의 properties에 섞는다.
	public static Properties(): Record<string, unknown>
	{
		return {
			Schedule: { type: "string", enum: ["None", "After", "At"], description: "예약 방식. None=예약 없음(수동 실행만), After=AfterSeconds 뒤, At=AtTime 시각" },
			AfterSeconds: { type: "number", minimum: 1, description: "Schedule=After일 때 몇 초 뒤에 실행할지. Repeat=true면 이 간격마다 반복" },
			AtTime: { type: "string", description: "Schedule=At일 때 실행 시각. \"HH:mm\"(오늘, 지났으면 내일) 또는 \"YYYY-MM-DD HH:mm\"" },
			AtDate: { type: "string", description: "선택. AtTime이 \"HH:mm\"일 때 날짜 \"YYYY-MM-DD\"를 따로 줄 수 있다" },
			Repeat: { type: "boolean", description: "반복 수행. After는 같은 간격마다, At은 매일 같은 시각. 예약(After/At)과 함께만 쓴다" },
			KeepAfterBoot: { type: "boolean", description: "부팅 후에도 스케줄 적용(등록 기본 false). false면 PC를 다시 켜거나 다시 로그인한 뒤 Scouter가 시작될 때 이 항목의 예약을 푼다. Scouter만 다시 켠 경우는 유지한다. 어느 쪽이든 꺼져 있는 동안 지난 회차는 실행하지 않는다" },
		};
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// 인자 값 필드 스키마. 이름별 객체 또는 순서대로 배열을 받는다.
	public static ArgValues(): Record<string, unknown>
	{
		return {
			oneOf: [
				{ type: "object", additionalProperties: { type: "string" } },
				{ type: "array", items: { type: "string" } },
			],
			description: "인자 값. {\"인자 이름\": \"값\"} 또는 [\"값1\", \"값2\"](정의 순서). 저장된 값을 바꾸고 화면 입력란에도 반영된다",
		};
	}
}
