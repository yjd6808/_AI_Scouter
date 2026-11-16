# ScriptRunner 레시피

로컬 스크립트(.ps1 .bat .cmd .exe .py .js)를 등록해 두고 즉시 실행·중지·예약 실행한다.

## Tool 고르기

| 하고 싶은 일 | Tool |
|---|---|
| 등록 상태·실행 중 목록 확인 | `ScriptRunner__List` (`RunningOnly=true`면 실행 중만) |
| 새 스크립트 등록(+ 예약, + 바로 실행) | `ScriptRunner__Register` |
| 제목·경로·인자·예약 고치기 | `ScriptRunner__Update` |
| 지금 실행 | `ScriptRunner__Run` (`Wait=true`면 끝날 때까지 기다려 출력까지 받음) |
| 실행 중지 | `ScriptRunner__Stop` (`All=true`면 전부) |
| 출력 보기(마지막 실행) | `ScriptRunner__GetOutput` |
| 실행 로그 보기(지난 실행 포함) | `ScriptRunner__GetLog` |
| 인자 프리셋 저장·삭제·불러오기 | `ScriptRunner__Preset` |
| 목록에서 삭제 | `ScriptRunner__Remove` |

## 절차

1. 먼저 `List`로 이미 등록된 같은 경로가 있는지 본다. 있으면 새로 등록하지 말고 그 `Id`를 쓴다.
2. 등록할 때 인자는 `Args`에 순서대로 정의한다. 실행 시 정의 순서대로 위치 인자로 넘어간다. 가운데 빈 값은 빈 문자열로 자리를 지키고(뒤 인자가 밀리지 않음), 끝쪽의 빈 값만 빠진다.
   필수(`Required`, 기본 true) 인자가 비어 있으면 실행이 거부된다.
3. 실행할 때 값을 바꾸려면 `Run`의 `ArgValues`에 `{"인자 이름": "값"}` 또는 `["값1", "값2"]`를 준다. 준 값은 저장된다.
4. 결과가 필요하면 `Run`에 `Wait=true`를 주거나, 실행 뒤 `GetOutput`으로 출력과 `LastRun.ExitCode`를 확인한다.
5. 오래 도는 스크립트는 `Wait` 없이 실행하고 `List`의 `State`·`RemainText`로 진행을 본다.

## 프리셋

- 스크립트마다 인자 값 묶음을 이름으로 저장해 둔다(예: "release", "release-2"). `List`의 `Items[].Presets`·`SelectedPreset`에 있다.
- 저장: `Preset` `{Id, Action:"Save", Name, ArgValues?}` — ArgValues를 생략하면 지금 인자 값을 저장. 같은 이름은 덮어쓴다.
- 불러와 실행: `Run` `{Id, Preset:"release", Wait?}`. 불러오기만 하려면 `Preset` `{Action:"Load"}`.
- 삭제: `Preset` `{Action:"Delete", Name}`.

## 실행 로그

- 실행할 때마다 `▶ 실행 시작` 줄, 스크립트 출력 줄, `■ 결과` 줄이 실행 로그에 쌓인다. 예약 회차를 건너뛰거나 실패하면 `⚠` 줄이 남는다.
- 실행 중에도 1초 간격으로 출력이 쌓이고, 앱을 다시 켜도 남는다(최근 `LogHistoryLines`줄, 기본 5000).
- `GetLog` `{Id?, Lines?}`로 최근 줄을 읽는다. 마지막 실행 출력 전체가 필요하면 `GetOutput`.

## 예약

- `Schedule="After"` + `AfterSeconds`: N초 뒤 실행. `Repeat=true`면 같은 간격마다(예정 시각 기준) 반복.
- `Schedule="At"` + `AtTime`("HH:mm" 또는 "YYYY-MM-DD HH:mm", 날짜는 `AtDate`로 따로 줘도 됨): 그 시각에 실행.
  날짜 없는 시각이 이미 지났으면 내일로 넘어간다. `Repeat=true`면 매일 같은 시각.
- 예약 해제는 `Update`에 `Schedule="None"`.
- 예약 시각에 아직 실행 중이면 그 회차는 건너뛴다. 앱이 꺼져 있던 동안 지난 예약은 실행하지 않는다.
- `KeepAfterBoot`(부팅 후에도 스케줄 적용, 등록 기본 false): false면 PC를 다시 켜거나 다시 로그인한 뒤 Scouter가 시작될 때
  그 항목의 예약을 푼다. Scouter만 다시 켠 경우는 유지한다. 재부팅 뒤에도 계속 돌아야 하는 예약은 true로 등록한다.
  값만 바꾸려면 `Update`에 `KeepAfterBoot`만 준다(남은 시간은 그대로).

## 주의

- 작업 폴더는 스크립트 파일이 있는 폴더다.
- 출력은 실행 1회분만 보관한다(다음 실행이 덮어쓴다).
- 쓰기 Tool도 승인 없이(auto) 실행된다. 사용자가 요청하지 않은 스크립트를 등록·실행하지 않는다.
