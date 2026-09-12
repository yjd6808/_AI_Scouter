# Scouter 설계 문서 v5

> Scouter = 로컬 개발자 유틸리티 허브. Electron 단일 창 + WPF(XAML)식 XML 레이아웃 자체 UI 프레임워크(`@scouter/gui`) + Plugin + MCP(Streamable HTTP) 서버. 외부 AI 도구(Claude Code / OpenCode / Cursor)가 Scouter의 Plugin 기능을 Tool로 호출한다. 인앱 채팅 없음(D-01).

## v4 → v5 변경 요지

v4는 "무엇을 만들지"는 충분했지만 아래가 빠져 있거나 흩어져 있었다. v5는 **모든 문서를 재작성**하고 순서를 구현 순서로 다시 매겼다.

| 보강 항목 | v4 상태 | v5 |
|---|---|---|
| 라이브러리 선정·활용법 | 01에 스택 표만 있고, 각 기능이 라이브러리 API를 **어떻게** 쓰는지는 없음 | 문서마다 `§ 라이브러리` 절(패키지·버전·사용 API·코드·대안·주의점) + `A1-LibraryMatrix` 전체 매트릭스 |
| 클래스 구조 | 텍스트 트리만 | 문서마다 Mermaid `classDiagram` + 파일 단위 책임 표 |
| UI 디자인 | Shell ASCII 1장 | 화면마다 와이어프레임·치수·상태(hover/active/disabled/focus)·토큰 매핑·키보드 동작 |
| 시퀀스 다이어그램 | 없음 | 기능/버튼마다 Mermaid `sequenceDiagram`(정상·실패·취소 경로) |
| 구현 순서 | 주제별 | 01→23이 곧 구현 순서(로드맵 Phase와 1:1) |
| 기능별 분리 | 컨트롤 1개, 내장 Plugin 1개 문서 | 컨트롤 3분할, 내장 Plugin 4분할, 서비스·Main 프로세스·운영 분리 |

## 문서 목록 (= 구현 순서)

| # | 문서 | 로드맵 Phase | 한 줄 |
|---|---|---|---|
| 01 | [01-Overview-Architecture.md](01-Overview-Architecture.md) | — | 목표, 프로세스 모델, 계층, 전체 스택, 요청 흐름 2종 |
| 02 | [02-CodingConvention.md](02-CodingConvention.md) | P0 | sgcl C++ 컨벤션의 TS 이식, ESLint 커스텀 룰 구현 |
| 03 | [03-Scaffold-Build-Toolchain.md](03-Scaffold-Build-Toolchain.md) | P0 | npm workspaces, tsconfig, webpack 5, Electron 빈 창, Main 프로세스 최소, dev 루프 |
| 04 | [04-Gui-Core.md](04-Gui-Core.md) | P1 | UIElement / UIProperty / RoutedEvent / InputDispatcher / 크기 관찰 |
| 05 | [05-Gui-Panels.md](05-Gui-Panels.md) | P1 | Panel·Decorator·GridSplitter — CSS Grid/Flex 위임 |
| 06 | [06-Gui-Window-UIManager.md](06-Gui-Window-UIManager.md) | P1 | Window / UserControl / UIManager / 레이어 / 다이얼로그 |
| 07 | [07-Xml-Layout-Binding.md](07-Xml-Layout-Binding.md) | P2 | XmlLoader / BindingResolver / BindingGraph / DataList / Lint / 핫리로드 |
| 08 | [08-App-Services.md](08-App-Services.md) | P3 | Settings / EventBus / CommandRegistry / Hotkey / LogBuffer / Storage / Secrets / Schedule / Process / Clipboard |
| 09 | [09-Gui-Controls-Basic.md](09-Gui-Controls-Basic.md) | P3~P4 | Button 계열, TextBlock/TextBox, CheckBox/Radio, Range 계열, Image/Icon, Border |
| 10 | [10-Shell.md](10-Shell.md) | P3 | Shell.xml / ShellWindow / Sidebar / TitleBar(IPC) / StatusBar / 부트스트랩 |
| 11 | [11-Gui-Controls-Items.md](11-Gui-Controls-Items.md) | P4 | ItemsControl/Selector 계열, TabControl, TreeView, ListView, Menu, Popup, ToolTip |
| 12 | [12-Gui-Controls-Scouter.md](12-Gui-Controls-Scouter.md) | P4 | VirtualList / LogView / CodeEditor(Monaco) / DiffView / MarkdownView / PropertyGrid / Toast 등 |
| 13 | [13-Theme.md](13-Theme.md) | P5 | opencode 테마 엔진 이식, ThemeManager, Monaco 연동, ThemeLint |
| 14 | [14-Plugin-System.md](14-Plugin-System.md) | P6 | Manifest / Loader(esbuild) / Context / 권한 / Storage / 핫리로드 |
| 15 | [15-Mcp-Server.md](15-Mcp-Server.md) | P7 | node:http + `@modelcontextprotocol/sdk`, 세션, 승인, 감사, 업스트림 프록시 |
| 16 | [16-Plugin-ScouterCore.md](16-Plugin-ScouterCore.md) | P6~P7 | 설정 화면(PropertyGrid), 연결 스니펫, Layout/Theme/Plugin Tool |
| 17 | [17-Plugin-McpInspector.md](17-Plugin-McpInspector.md) | P7 | 세션·Tool·호출 로그·직접 호출 화면 |
| 18 | [18-Plugin-CommandPalette.md](18-Plugin-CommandPalette.md) | P9 | Ctrl+Shift+P 팔레트, fuzzy, 미리보기 |
| 19 | [19-Plugin-P4Util.md](19-Plugin-P4Util.md) | P8 | P4Runner(-ztag 파서), Tool 7종, Main.xml, Recipes |
| 20 | [20-Testing-Harness-CI.md](20-Testing-Harness-CI.md) | P0~ | node:test + happy-dom, Test API, Harness, Playwright, CI |
| 21 | [21-Operations-Packaging.md](21-Operations-Packaging.md) | P9 | 트레이, 자동 시작, electron-updater, NSIS, 로그 회전, About |
| 22 | [22-Roadmap.md](22-Roadmap.md) | — | Phase 표(문서 매핑, 완료 기준, 의존 그래프) |
| 23 | [23-Decisions.md](23-Decisions.md) | — | ADR D-01~D-25, 가정 A-01~A-08 |
| A1 | [A1-LibraryMatrix.md](A1-LibraryMatrix.md) | — | 패키지 × 기능 × API × 대안 × 리스크 전체 표 |
| A2 | [A2-Diagram-Index.md](A2-Diagram-Index.md) | — | 모든 클래스/시퀀스 다이어그램 색인 |

## 역할별 읽기 순서

- **구현자(AI)**: 01 → 02 → 03 → 04 … 순서대로. 각 문서 끝의 `§ 구현 체크리스트`가 Phase 완료 기준.
- **Plugin 작성자**: 01 §1.2 → 07 → 09/11/12(속성 표) → 14 → 16 §16.6(리소스) → 19(예제).
- **검토자(사용자)**: 01 → 10(Shell UI) → 13(테마) → 15 §15.3(승인 정책) → 22 → 23.

## 문서 작성 규칙

- 다이어그램은 모두 Mermaid(`classDiagram`, `sequenceDiagram`, `flowchart`, `stateDiagram-v2`). GitHub/VS Code/Obsidian에서 바로 렌더.
- 코드는 02 컨벤션(탭, Allman, `_param`, `member_`, `////` 구분선)을 따른다. 문서 내 발췌 코드는 길이를 위해 파일 헤더를 생략한다.
- 각 기능 문서의 절 구성은 고정: **목적 → 라이브러리 → 클래스 구조 → UI 디자인(해당 시) → 시퀀스 → 파일/API 표 → 테스트 → 구현 체크리스트**.
- 라이브러리 버전은 P0(03)에서 `package.json`에 고정한다. 문서의 버전은 "검증된 메이저"이며 `^`로 표기.
- 설정 키는 `Ui.SidebarWidth`처럼 PascalCase 점 표기(D-12). XML `Name`은 snake_case(D-03).

## 핵심 숫자·이름 한 곳에

| 항목 | 값 |
|---|---|
| MCP 엔드포인트 | `http://127.0.0.1:9515/mcp` (Bearer 토큰 `~/.scouter/mcp-token`) |
| 하네스 MCP | 포트 9516 (개발 전용) |
| 사용자 데이터 | `~/.scouter/` (settings.json, plugins/, themes/, logs/, mcp-token) |
| npm 패키지 | `@scouter/gui`, `@scouter/app`, `@scouter/plugin-api`, `@scouter/harness` |
| Tool 이름 | `{PluginId}__{ToolName}` (예 `P4Util__ExtractFiles`) |
| EventBus 키 | `Scouter.*`(앱), `{PluginId}.*`(Plugin) |
| 기본 테마 | `oc-2`, Scheme `System` |
| 사이드바 폭 | `Ui.SidebarWidth` 150 (100~400), 접힘 48 |
