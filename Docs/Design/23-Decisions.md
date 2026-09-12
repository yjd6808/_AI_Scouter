# 23. 결정 기록 · 가정 · 사용자 확인 항목

> v4 D-01~D-17은 그대로 유지. v5에서 라이브러리·구현 방식을 확정하며 생긴 결정을 D-18~D-25로 추가. 문서 번호는 v5 기준.

## 23.1 결정 (D)

| ID | 결정 | 이유 / 근거 | 관련 |
|---|---|---|---|
| D-01 | 인앱 채팅 제외. Scouter는 **MCP 서버**로서 외부 AI 클라이언트(Claude Code/OpenCode/Codex)가 이용 | 채팅 UI와 모델 과금을 직접 다루지 않음. 2026-09-06 사용자 확정 | 01, 15 |
| D-02 | XML 문법 = sgcl sgui | 사용자 익숙, `ui_channel.xml` 그대로 로드 가능 | 07 |
| D-03 | 태그·속성은 WPF 이름, `Name`은 snake_case = `data-testid` | 테스트에서 그대로 검색 | 07, 20 |
| D-04 | React/Vue 안 쓰고 자체 바닐라 DOM `@scouter/gui` | 바인딩·이벤트 구조가 WPF와 다르고, 의존 없이 완전 통제 | 04 |
| D-05 | 앱 번들 webpack 5, Plugin 동적 로드만 esbuild | 가장 검증된 설정 + Plugin은 런타임 번들 필요 | 03, 14 |
| D-06 | 레이아웃은 CSS(Grid/Flex)에 위임, Measure/Arrange 없음(포기: SharedSizeGroup) | 별도 레이아웃 엔진 재구현 불요 | 05 |
| D-07 | `Window extends ContentControl`, 레이어 DOM에 마운트 | 06 |
| D-08 | sgcl C++ 컨벤션 TS 이식, ESLint 강제, Prettier 안 쓰기 | Allman·탭을 Prettier가 못 맞춤 | 02 |
| D-09 | opencode 테마 엔진 이식, CSS 변수만 | 37개 테마 자산 재활용 | 13 |
| D-10 | P4Util = 복합 작업 유틸 + Recipes, 상태 변경 Tool 1차 제외 | AI가 p4는 이미 직접 실행 가능 | 19 |
| D-11 | 단일 Renderer가 모든 것, Main은 창/트레이/업데이트/IPC만 | 개인 도구에서 보안 경계보다 단순성 | 01, 21 |
| D-12 | 설정 키 PascalCase 점 표기 `Ui.SidebarWidth` | 08 |
| D-13 | Plugin 메인 화면은 UserControl, Window는 다이얼로그만 | 06, 14 |
| D-14 | 단방향 바인딩, 문자 속성 항상 보간 | 07 |
| D-15 | Plugin 권한은 설치 시 1회 승인(`permissions.json`) | 14 |
| D-16 | Test API·하네스 P0 포함 | AI 자가 검증 | 20 |
| D-17 | Plugin 동일 프로세스, esbuild 번들 후 `import()`, Worker 격리 없음 | 14 |
| **D-18** | 문서 다이어그램은 Mermaid(`classDiagram`, `sequenceDiagram`, `flowchart`)로 통일, ID `C{문서}-{n}`/`S{문서}-{n}` | 텍스트 diff 가능, GitHub/VSCode 렌더 | A2 |
| **D-19** | MCP는 sdk **low-level `Server`** + `StreamableHTTPServerTransport`(`McpServer` 고수준 API 안 씀) | Tool이 런타임에 바뀌므로 `setRequestHandler(ListTools)` 동적 처리 필요; 스키마는 JSON Schema(ajv)로 받고 zod는 peer만 | 15 |
| **D-20** | XML 파싱은 런타임 `DOMParser`, 린트/Node 쪽은 `@xmldom/xmldom` | 런타임 의존 0, 린트에만 작은 의존 | 07 |
| **D-21** | 마크다운 `marked` + `dompurify`, 코드 에디터 `monaco-editor`(P10) | Recipes/Docs 렌더, 테마 토큰 연동 | 12 |
| **D-22** | 창 제어·스크린샷·폴더 열기 등 OS 작업은 모두 IPC 채널(`Shared/IpcChannels.ts`) | `frame:false` 커스텀 TitleBar; Renderer에서 `remote` 안 쓰기 | 10, 21 |
| **D-23** | Plugin 번들러는 esbuild JS API + `ScouterExternalsPlugin`(`@scouter/*`, `electron`, `node:*` external → `window.__scouter_modules__`) | Plugin이 앱 인스턴스와 동일 클래스 공유 필요 | 14 |
| **D-24** | simple-git 등 VCS 라이브러리 1차 제외, p4는 CLI spawn + 자체 ztag 파서 | 사용자 환경은 Perforce; 네이티브 모듈 회피 | 19 |
| **D-25** | XML 레이아웃은 번들에 넣지 않고 `dist/renderer/Layout/`로 복사(핫리로드·사용자 오버라이드), 테스트는 `tsx` 런너 | `--layout-dir`/`~/.scouter/layouts` 우선 순서와 일관; 데코레이터 때문에 strip-types 불가 | 03, 07, 20 |

## 23.2 의도적으로 쓰지 않는 라이브러리

| 라이브러리 | 대신 | 이유 |
|---|---|---|
| express / fastify | `node:http` + Router 40줄 | 라우트 10개, 보안 표면 최소 |
| electron-store / electron-log | 자체 Settings(ajv) / FileSink | 스키마 검증·회전 정책이 자체 요구와 다름 |
| prettier | ESLint stylistic | D-08 |
| vite / esbuild-loader / MiniCssExtract | webpack + ts-loader + style-loader | D-05, CSS는 테마가 런타임 생성 |
| react / vue | `@scouter/gui` | D-04 |
| iconv-lite | `P4CHARSET=utf8` | 19 |
| lodash | 필요 함수 직접 | 번들 가벼움 |
| jsep / expression 파서 | 자체 BindingResolver | 문법이 고정·작음(07) |
| fuse.js / fuzzysort | `Fuzzy.Score` | 18 |
| p4 node 모듈 | CLI spawn | D-24 |
| yargs / commander | `node:util.parseArgs` | 03 |
| semver | 자체 3자리 버전 범위 비교 | Plugin.json `Engine` 최소 버전만 |
| archiver | adm-zip(후보) | PluginPack만, 사용자 확인 |
| Tauri | Electron | Node 런타임을 Renderer에서 직접 사용(D-11) |

## 23.3 가정 (A) — 확인 필요

| ID | 가정 | 틀린 경우 영향 |
|---|---|---|
| A-01 | `전체.zip`에 C# 소스가 없어 "C# 스타일"을 sgcl C++ 스타일에서 추론 | 02 룰 일부 수정 |
| A-02 | Allman 중괄호를 TS에도 적용 | ESLint 1줄 |
| A-03 | 사이드바 GridSplitter 설정 on/off(기본 on) | 기본값 변경 |
| A-04 | `Click="OnRunClick"`와 `FindName` 모두 지원, 기본 FindName | 문서 예제 방향 |
| A-05 | 기본 테마 oc-2, Segoe UI / Cascadia Code | Defaults.json |
| A-06 | XML Name snake_case | lint 룰 |
| **A-07** | Electron LTS 버전을 P0에서 핀(03 §3.9 표) — 문서는 범위만 | Node API 가용성(A-08) |
| **A-08** | Node 22 API(`parseArgs`, `fs.glob`, `mock.timers`) 사용 가능 | Electron 버전에 따라 대체 필요 |

## 23.4 사용자 확인 요청 (v5에서 새로 생김)

| # | 항목 | 현재 문서 값 | 위치 |
|---|---|---|---|
| 1 | 버전 핀(Electron/TS/webpack 등) | 범위만, P0에서 고정 | 03 §3.9 |
| 2 | 테스트 TS 실행기 | tsx (데코레이터 때문) | 20 |
| 3 | 프로덕션 CSP `unsafe-eval` 제거 | P5에서 검증 | 03, 13 |
| 4 | `Theme.Density` Compact/Normal | Normal 기본 | 13 |
| 5 | 승인 다이얼로그 타임아웃 | 30s Deny (v4는 60s) | 12, 15 |
| 6 | 승인 기본 설정 키 | `Mcp.DefaultApproval`로 단일화(15 §15.7 기준) | 15 |
| 7 | PluginPack zip 라이브러리 | adm-zip | 21 |
| 8 | Windows `mcp-token` ACL(0600 불가) | `icacls` 후처리 제안 | 15 |
| 9 | 코드 사이닝 | 보류 | 21 |
| 10 | 업데이트 URL(사내 서버) | 미정 | 21 |
| 11 | 한글 초성 fuzzy | 안 함 | 18 |
| 12 | Windows CI 러너 | 미정 | 20 |
| 13 | P11 킬러 Plugin 선택(2~3개) | LogWatch, BuildRunner, Clipboard, Notes, SqlPad 중 | 22 |
