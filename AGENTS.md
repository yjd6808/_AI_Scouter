# AGENTS.md — Scouter 작업 지침

> 이 파일은 AI 에이전트용이다. 작업 시작 시 읽는다. 작업 내역은 여기에 기록하지 않는다.

## 1. 프로젝트

로컬 개발자 유틸리티 허브. Electron 단일 창 + 자체 UI 프레임워크(`@scouter/gui`)

+ Plugin + MCP(Streamable HTTP) 서버. 인앱 채팅 없음.
  설계 문서: `Docs/Design/` 

## 2. 명령

```
npm install
npm run lint → npm run typecheck → npm run build → npm run test:unit → npm run test:e2e
npm run lint:layout / npm run lint:theme / npm run pack
```

## 3. 코딩 컨벤션 (위반하면 lint 빨강)

`Docs/Design/02-CodingConvention.md`가 정답. 요약: 탭, Allman, 파일 헤더,
`////` 메서드 구분선, 멤버 그룹 순서(정적→멤버→생성·소멸→속성→이벤트→공개→확장점→내부),
`_param`·`member_`·`s_` 접두, 루프 `idx`, `any` 금지, 파일 1개 = 클래스 1개.
한글 주석은 Write 도구로만 작성. 한국어 답변.

## 4. 플러그인 추가

`Plugins/AGENTS.md`를 따른다. 외부 플러그인은 `Plugins/{Id}/` + `Plugin.json`.
새 플러그인 뒤에는 루트 `package.json`의 `typecheck`·`lint:layout`에 경로 추가.

## 5. 테스트 규칙

- 단위: `Source/Scouter.Tests/Unit/**`, 가짜 객체 주입. E2E: `Source/Scouter.Tests/E2E/**`.
- E2E 포트: 9521 Shell, 9522 Mcp, 9523/9524 P4Util, 9525 팔레트, 9526 Notes — 신규는 9527번부터.
- 스폰: `dist/main/Main.cjs --test --hidden --no-auth --port {N} --plugin-dir Plugins`.
  승인 필요 Tool은 `before`에서 `POST /test/approval {Policy:"allow"}`.
- 외부 서버·바이너리 의존 테스트는 `SCOUTER_X_MODE` + `t.skip()` 분기 (P4Util 선례).
- `npm run typecheck`는 Tests를 포함하지 않는다. 그래도 새 테스트 파일은 타입 오류 없이.
- UI 육안 검증은 `Scripts/Testing/` 스크립트로 한다. 규칙:
  `Capture-Window.ps1 -Title "Scouter"`로 창 캡처 → Read 도구로 이미지 확인.
  `Send-Mouse.ps1 hover/click x y`로 실마우스 재현 (툴팁·호버·클릭 가로챔 확인용).
  E2E 합성 이벤트는 hit-testing을 우회하므로, 클릭 계열 수정 뒤에는 반드시 실마우스로 확인.
  PrintWindow 캡처는 GPU 창이 검게 나오니 쓰지 않는다. 전역 Foreground + CopyFromScreen 방식 사용.
  상세는 `Scripts/Testing/README.md`.

## 6. Git 규칙

- 커밋·푸시·PR은 사용자가 명시할 때만.
- 커밋 제외(무시됨): `node_modules/ dist/ release/ coverage/ .cache/ out/ *.tsbuildinfo`,
  `Plugins/*/.cache/ Source/*/.cache/`. 산출물·로그·temp를 커밋에 섞지 않는다.
- `Assets/` 아이콘은 생성물이어도 커밋한다 (pack에 필요, `Scripts/MakeIcons.mjs`로 재생성 가능).

## 7. 세션 인계 (멈춤없이 계속 개발용)

- 작업이 바뀌면 `.admin/working/YYYY-MM-DD-{제목}.md`를 만든다(날짜는 당일).
- 문서는 3섹션 고정: `이전 세션 작업` / `다음 세션 작업` / `프롬프트`(다음 세션 지시문).
- 새 세션 시작 시 해당 문서를 먼저 읽고 프롬프트 섹션대로 이어간다.
