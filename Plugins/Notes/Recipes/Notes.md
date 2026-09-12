# Notes 레시피 (외부 AI용)

> 사용자에게 보여줄 것이 아니라 네가 따를 절차다.

## 추가 우선
1. `Notes__Append({ Text })`로 먼저 기록한다. `Note` 생략 시 기본 노트(inbox).
2. 새 주제면 `Note`에 짧은 이름(영문·하이픈)을 준다. 예: `mabinogi-release`.
3. 한 항목은 한 줄. 길면 여러 항목으로 나눈다.

## 읽기
- 목록이 필요하면 `Notes__List`, 본문은 `Notes__Read({ Note })`.
- 여러 노트에 흩어진 내용은 `Notes__Search({ Query })`로 모은다.

## 금지
- 파일 경로를 직접 만들지 않는다. 이름은 Tool에 맡긴다.
- 기존 본문을 Tool 없이 고쳐쓰지 않는다. 수정은 전체를 읽고 `Notes__Append`가 아니라 화면 저장에 맡긴다.
