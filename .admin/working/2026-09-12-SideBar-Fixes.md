# working 2026-09-12 — 사이드바·실행화면 수정

## 이전 세션 작업

- 실행 화면 4건: Shell 전체 채우기, 버튼 중앙 정렬, dev 외부 플러그인 기본 로드, dev 버전 표시.
- 사이드바 3건: 스플리터 컬럼 수정(150·4·*), 툴팁 클릭 통과, nav 좌측 정렬.
- 핫리로드 실패 사유 표시, Shell 명령 중복 등록 방지, 테스트 모드 핫리로드 off.
- `Plugins/AGENTS.md`, `Scripts/Testing/` + `Scripts/README.md`, 루트 `AGENTS.md` §5·§7.
- 검증: lint·typecheck·build 녹색, unit 186/187(기존 Mcp 1건), e2e 8+1스킵. 실마우스 클릭 이동 확인.

## 다음 세션 작업

- P11 나머지(LogWatch·BuildRunner·Clip·SqlPad) 중 사용자 선택 1개 구현.
- 사용자 확인 대기: NSIS 설치·재부팅, 코드 사이닝, 사내 업데이트 URL, 초성 fuzzy, DatePicker/Shape 스펙.
- 미해결 의심: dev 앱이 가끔 조용히 죽음(원인 불명, libuv assertion 의심). 재현되면 Main 크래시 로그부터 볼 것.

## 프롬프트 (다음 세션 지시문)

```
Scouter/AGENTS.md를 읽고 .admin/working/2026-09-12-SideBar-Fixes.md 이전 작업을 파악하라.
사용자가 P11 다음 플러그인을 지목하면 Plugins/AGENTS.md 절차대로 구현·검증하라.
지목이 없으면 미해결 의심(앱 무단 종료)부터 재현·진단하라.
`npm run lint → typecheck → build → test:unit → test:e2e` 전부 녹색으로 마친다.
새 세션 문서(.admin/working/날짜-제목.md)를 같은 3섹션 형식으로 남긴다.
```
