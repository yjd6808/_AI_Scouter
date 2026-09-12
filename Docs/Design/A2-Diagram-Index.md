# A2. 다이어그램 색인

> 모든 다이어그램은 Mermaid(D-18). ID 규칙: `C{문서}-{n}` 클래스, `S{문서}-{n}` 시퀀스. 문서 안에서는 `### S10-2 …` 형식의 제목으로 검색 가능.

## A2.1 클래스 다이어그램

| ID | 문서 | 대상 |
|---|---|---|
| 03 §3.5 | 03 | Main 프로세스 (P0 버전) — 21 C21-1이 완성본 |
| C4-1 | 04 | UIElement / UIProperty / RoutedEvent / InputDispatcher / ElementRegistry / Control 계층 |
| C5-1 | 05 | Panel 계층 (Grid, StackPanel, DockPanel, Canvas, WrapPanel, UniformGrid, ScrollViewer, GridSplitter) |
| C6-1 | 06 | Window / UIManager / UILayer / ContentPresenter / UserControl / Dialog |
| C7-1 | 07 | XmlLoader / ElementCatalog / AttributeApplier / BindingResolver / BindingGraph / DataList / LayoutProvider / LayoutLint |
| 07 (두 번째) | 07 | 바인딩 토큰·AST 타입 |
| C8-1 | 08 | Settings / Log / EventBus / CommandRegistry / Hotkeys / Process / Storage |
| C9-1 | 09 | 기본 컨트롤 (TextBlock, Button, ToggleButton, CheckBox, RadioButton, TextBox, PasswordBox, NumericUpDown, Slider, ProgressBar, Label, Image, Icon, Separator, Border) |
| C10-1 | 10 | ShellWindow / SidebarController / IpcWindowChrome / ShellCommands / Bootstrap |
| C11-1 | 11 | 항목 컨트롤 (SelectionModel, ListBox, ComboBox, ListView/GridView, TabControl, TreeView, DataGrid, Menu, ToolBar, StatusBar, Popup, ToolTip, Expander, GroupBox) |
| C12-1 | 12 | Scouter 전용 (VirtualList, LogView, CodeEditor, DiffView, MarkdownView, PropertyGrid, Badge, StatusDot, Avatar, Spinner, TitleBar, Toast, ApprovalDialog) |
| C13-1 | 13 | ThemeLoader / Resolver / Css / Lint / Manager / MonacoTheme / ThemePicker |
| C14-1 | 14 | PluginManager / Handle / Discovery / ManifestValidator / Bundler / PermissionStore / PluginContext / ToolRegistry / Watcher |
| C15-1 | 15 | McpHttpServer / Router / Auth / SessionManager / McpCore / Registries / ApprovalManager / ToolInvoker / AuditLog / UpstreamProxy / ResultTruncator |
| C16-1 | 16 | ScouterCorePlugin / SettingsMainControl / ConnectView / SettingsCatalog / ConnectSnippets / Tools / DocsResources |
| C17-1 | 17 | McpInspectorPlugin / InspectorMainControl / CallPanel / CallLogBuffer / ToolTreeModel |
| C18-1 | 18 | CommandPalettePlugin / PaletteWindow / ItemSource×3 / Fuzzy / RecentStore |
| C19-1 | 19 | P4UtilPlugin / P4Runner / ZtagParser / Tool×7 / MainControl |
| C20-1 | 20 | TestApiServer / ElementInspector / InputSimulator / Harness / HarnessCli / HarnessMcp |
| C21-1 | 21 | AppHost / MainWindow / TrayController / UpdateController / IpcHost / AutoStart / CrashReporter |

## A2.2 시퀀스 다이어그램

| ID | 문서 | 트리거 (버튼/이벤트) | 개요 |
|---|---|---|---|
| 03 §3.6 | 03 | 앱 시작 (P0) | Main → BrowserWindow → Renderer Bootstrap → Test API ping |
| 03 §3.6 | 03 | 파일 변경 | dev 루프 핫리로드 |
| S4-1 | 04 | `SetValue` | 속성 변경 → DOM 반영 → 바인딩 재평가 |
| S4-2 | 04 | pointerdown | Tunnel(Preview) → Bubble → Click |
| S4-3 | 04 | Attach | Loaded 생애주기 |
| S4-4 | 04 | ResizeObserver | SizeChanged |
| S5-1 | 05 | `AddChild` | 붙임 속성 → CSS grid-area |
| S5-2 | 05 | 스플리터 드래그 | 포인터 캡처 → 열 크기 → `Ui.SidebarWidth` 저장 |
| S5-3 | 05 | Dock 변경 | 슬라이스 재구성 |
| S5-4 | 05 | Append | ScrollViewer 자동 스크롤 |
| S6-1 | 06 | `UIManager.Show` | XML 로드 → 레이어 마운트 → OnShown |
| S6-2 | 06 | `ShowDialog` | 모달 → Promise 결과 |
| S6-3 | 06 | ESC | Closing 취소 가능 |
| S6-4 | 06 | Navigate | ContentPresenter 스와프 |
| S6-5 | 06 | `Reload` | DataList 스냅샷 → 재구성 → 복원 |
| S7-1 | 07 | XML 로드 | 2-pass(생성 → 바인딩) |
| S7-2 | 07 | `DataList.Update` | 의존 그래프 재평가 |
| S7-3 | 07 | 파일 변경 | 핫리로드 |
| S7-4 | 07 | CLI | LayoutLint |
| S8-1 | 08 | `Settings.Set` | 검증 → Changed → 바인딩 → 디바운스 저장 |
| S8-2 | 08 | 키 입력 | Hotkeys → CommandRegistry |
| S8-3 | 08 | `Log.Info` | 링버퍼 → 파일 → LogView |
| S9-1 | 09 | Button 클릭 | Click → Command |
| S9-2 | 09 | TextBox Enter/blur | TextCommitted → DataList |
| S9-3 | 09 | RadioButton | 그룹 배타 선택 |
| S9-4 | 09 | NumericUpDown ▲▼ | 스핀·연속 스핀 |
| S9-5 | 09 | Slider 드래그 | 캡처 → 값 → ValueChanged |
| S10-1 | 10 | 앱 시작 | Bootstrap 10단계 → Shell 표시 |
| S10-2 | 10 | 사이드바 항목 | Plugin 메인 뷰 전환(캐시) |
| S10-3 | 10 | TitleBar 버튼 | IPC → BrowserWindow |
| S10-4 | 10 | Ctrl+B | 사이드바 접기 |
| S11-1 | 11 | ListBox 항목 클릭 | SelectionModel → SelectionChanged |
| S11-2 | 11 | ComboBox | Popup 열기 → 선택 |
| S11-3 | 11 | GridView 헤더 | 정렬 · 열 리사이즈 |
| S11-4 | 11 | 우클릭 | ContextMenu → MenuItem 실행 |
| S11-5 | 11 | hover | ToolTip 400/100ms |
| S12-1 | 12 | `LogView.Append` | 가상 렌더 |
| S12-2 | 12 | 테마 변경 | Monaco defineTheme |
| S12-3 | 12 | PropertyGrid 편집 | Settings 반영 |
| S12-4 | 12 | Toast | 표시 → 액션 → 닫기 |
| S12-5 | 12 | ApprovalDialog | Allow/AllowAlways/Deny, 30s 타임아웃 |
| S13-1 | 13 | 시작 | 테마 초기화 |
| S13-2 | 13 | ThemePicker ↑↓ | 미리보기 → 적용/취소 |
| S13-3 | 13 | 테마 파일 변경 | 핫리로드 |
| S13-4 | 13 | MCP `ThemeCreate` | 파생 테마 생성 |
| S14-1 | 14 | 시작 | LoadAll(Discovery → Validate → Permission → Bundle → import → Activate) |
| S14-2 | 14 | 사이드바 선택 | 메인 뷰 생성 |
| S14-3 | 14 | Plugin 파일 변경 | 핫리로드 |
| S14-4 | 14 | `ctx.Shell.Exec` | 권한 검사 → Process |
| S15-1 | 15 | initialize | 세션 생성 |
| S15-2 | 15 | tools/call | Auth → Approval → Invoke → Truncate → Audit |
| S15-3 | 15 | Plugin 리로드 | list_changed 알림 |
| S15-4 | 15 | btn_regen_token | 토큰 재발급 → 세션 종료 |
| S15-5 | 15 | 시작 | UpstreamProxy 연결·재시도 |
| S16-1 | 16 | 설정 셀 편집 | 검증 → 저장 → 재시작 안내 |
| S16-2 | 16 | btn_copy | 스니펫 복사 |
| S16-3 | 16 | AI MakePlugin | 프롬프트 → Docs → Scaffold → 핫리로드 루프 |
| S16-4 | 16 | `LayoutSet` | 핫리로드 |
| S17-1 | 17 | ToolCalled 이벤트 | 로그 실시간 갱신 |
| S17-2 | 17 | btn_invoke | 직접 호출 |
| S17-3 | 17 | 인라인 ComboBox | 승인 정책 변경 |
| S17-4 | 17 | 세션 종료 버튼 | CloseSession |
| S18-1 | 18 | Ctrl+Shift+P | 열기 → 검색 → Enter |
| S18-2 | 18 | `theme ` ↑↓ | 미리보기/원복 |
| S18-3 | 18 | `set ` Enter | 인라인 설정 수정 |
| S19-1 | 19 | btn_run | 추출 → 배치 → 결과 |
| S19-2 | 19 | btn_cancel | 중단 / 오류 |
| S19-3 | 19 | btn_copy_prompt | 프롬프트 복사 |
| S19-4 | 19 | MCP tools/call | 외부 AI 호출 |
| S20-1 | 20 | E2E 테스트 | Harness → Test API |
| S20-2 | 20 | AI 개발 루프 | 하네스 MCP 9516 |
| S20-3 | 20 | L2 테스트 | 코드 패턴 |
| S21-1 | 21 | btn_close | 트레이 → 복원 → 종료 |
| S21-2 | 21 | 업데이트 체크 | 다운로드 → Toast → 설치 |
| S21-3 | 21 | 핫키 설정 변경 | globalShortcut 재등록 |
| S21-4 | 21 | 첫 실행 | 초기화 → 안내 |

## A2.3 기타

| 문서 | 종류 | 내용 |
|---|---|---|
| 01 | flowchart | 전체 아키텍처(Main/Renderer/Plugin/MCP 클라이언트) |
| 22 | flowchart | Phase 의존 그래프 |
| 06, 10, 16, 17, 18, 19, 21 | ASCII | UI 디자인(화면 레이아웃 · 치수 · 상태) |
