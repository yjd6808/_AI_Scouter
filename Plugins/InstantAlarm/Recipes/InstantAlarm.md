# InstantAlarm 레시피 (외부 AI용)

> 사용자에게 보여줄 것이 아니라 네가 따를 절차다.

## Tool 6종

| Tool | 인자 | 하는 일 |
|---|---|---|
| `InstantAlarm__ArmAfter` | `Seconds`(필수, 1 이상), `Title`(필수), `Message?` | 지금부터 N초 뒤 1건 예약 |
| `InstantAlarm__ArmAt` | `AtTime`(필수), `Title`(필수), `Message?`, `RollToNextDay?` | 지정 시각 1건 예약 |
| `InstantAlarm__List` | 없음 | 예약·완료·지나감·취소 목록 + 남은 시간. 읽기 전용이라 승인 없이 불린다 |
| `InstantAlarm__ArmGroup` | `GroupName`(필수) | 저장된 그룹을 통째로 예약 |
| `InstantAlarm__Cancel` | `Id` 또는 `All` | 예약 1건 또는 예약 전체 취소 |
| `InstantAlarm__SaveGroup` | `Name`(필수), `Specs`(필수, 배열) | 그룹(템플릿) 저장. 같은 이름이면 덮어쓴다 |

`SaveGroup`의 `Specs` 요소는 `{ Title, Seconds }`(상대) 또는 `{ Title, AtTime, RollToNextDay? }`(절대) 형태다.
`Message`·`KindUi`(`ok`/`yesno`)·`DurationSec`·`Topmost`·`WithToast`를 함께 넣을 수 있고, 생략하면 설정 기본값이 들어간다.

## 절차

1. 먼저 `List`로 지금 상태를 본다. 읽기 전용이라 언제든 불러도 된다.
2. 같은 일을 반복할 것 같으면 `SaveGroup`으로 템플릿을 만들고 `ArmGroup`으로 건다.
3. 예약 결과의 `Id`를 기억해 두면 `Cancel`로 되돌릴 수 있다.
4. 실패는 예외로 돌아온다. `"이미 지난 시각: 09:00"`처럼 사유가 그대로 담긴다.

## 알람 종류
- **After(상대)** — 지금부터 `Seconds`초 뒤. 1초 미만은 거부된다.
- **At(절대)** — `HH:mm` 또는 `YYYY-MM-DD HH:mm`.
  - `HH:mm`은 예약하는 날의 날짜에 붙는다.
  - 이미 지난 시각이면 `RollToNextDay=true`일 때만 다음 날로 넘어간다. false면 예약이 거부된다.

## 그룹(템플릿)
1. 알람 여러 개를 그룹으로 묶어 두고 한 번에 예약한다.
2. 예약 순간 하나의 기준 시각으로 전부 계산한다. 상대 알람은 그 시각부터 다시 세고,
   날짜 없는 절대 알람은 예약일 날짜에 붙는다. 날짜까지 적힌 절대 알람은 그 날짜를 그대로 쓴다.
3. 예약된 알람은 스펙 스냅샷을 들고 있다. 원본 그룹을 고치거나 지워도 이미 예약된 건은 그대로 울린다.

## 재시작 연속성
- 남은 시간은 저장하지 않는다. 저장되는 시간 값은 `DueAtMs`(절대 epoch ms) 하나뿐이고,
  남은 시간은 언제나 `DueAtMs - now`로 파생한다. 꺼져 있던 만큼 저절로 줄어든다.
- 앱이 켜질 때 한 번만 분류한다. `Armed`이고 마감이 지났고 아직 안 울린 건은 **놓침**이다.
- 이미 울린 건(`FiredAtMs > 0`)은 응답을 못 받았어도 놓침이 아니다. 결과는 `closed`로 남는다.
- 시계가 거꾸로 갔으면 판정을 보류하고 경고만 남긴다.

## 금지
- 남은 시간(초)을 저장하거나 그 값으로 판정하지 않는다. 항상 `DueAtMs` 기준이다.
- 이미 예약된 건의 시각을 다시 계산하지 않는다. 재계산은 새로 예약할 때만 한다.
- 화면이 열려 있는지 신경 쓰지 않는다. 엔진은 창이 닫혀 있어도 돈다.
