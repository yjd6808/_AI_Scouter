# 계획: P9 운영 (18 CommandPalette + 21 Operations-Packaging)

## 목표
- 18: 내장 CommandPalette (Ctrl+Shift+P, fuzzy, set/theme 모드, 미리보기 원복)
- 21: Main 프로세스 운영 (트레이, 자동 시작, 글로벌 핫키, 단일 인스턴스, 업데이트, NSIS, 로그 회전, About, 첫 실행)
- 완료 기준: 설치 → 재부팅 → 자동 실행 → Claude Code 재연결 (사용자 PC 확인)

## 사전 조사 결과 (2026-09-12)
- Main은 Main.ts/WindowFactory.ts/Ipc.ts/LaunchArgs.ts 4개만 있음. AppHost/Tray/Updater 없음.
- BuiltIn은 ScouterCore/McpInspector만 있음. CommandPalette 없음.
- UIManager.Show/ShowDialog는 Base/Dialog 레이어만. Popup 레이어 창 Show 없음.
- Window.Close()는 기본 무시(OnCloseRequested 빈 구현, 배선 없음). ThemePicker/Approval 다이얼로그의 Close 호출이 실제로 안 닫힘.
- ThemeManager.Set은 즉시 적용 + Settings 미기록은 ThemeSetTool이 담당. Preview() 없음.
- CommandRegistry.List(), Hotkeys.Bind, SettingsCatalog(스키마 자동 반영) 있음.
- electron-updater 미설치, Assets/ 없음.

## 파일 목록
- Source/Scouter.Gui/Host/UIManager.ts: ShowPopup/ShowPopupAsync 추가 + Create에서 닫기 배선
- Source/Scouter.Gui/Host/Window.ts: SetCloser 추가 (순환 import 없이 UIManager.Close 연결)
- Source/Scouter.Tests/Unit/Gui/UIManagerPopup.test.ts: 팝업 배치·바깥 클릭·ESC·닫기 배선
- Source/Scouter.App/Renderer/Theme/ThemeManager.ts: Preview 추가
- Source/Scouter.App/Renderer/BuiltIn/CommandPalette/{Plugin.json,Index.ts,Fuzzy.ts,RecentStore.ts,Sources/CommandSource.ts,Sources/SettingsSource.ts,Sources/ThemeSource.ts,Views/PaletteWindow.ts,Layout/Main.xml}
- Source/Scouter.Tests/Unit/App/CommandPalette.test.ts: Fuzzy/RecentStore/모드 전환
- Source/Scouter.Tests/E2E/CommandPalette.test.ts: Ctrl+Shift+P → toggle → 사이드바 변경
- Source/Scouter.App/Main/{AppHost.ts,MainWindow.ts,TrayController.ts,UpdateController.ts,IpcHost.ts,AutoStart.ts,CrashReporter.ts,MainLog.ts} + Shared/IpcChannels.ts
- Source/Scouter.App/Config/Settings.schema.json: App.StartHidden/Update.*/Hotkeys.Global.Show 추가
- electron-builder.yml: appId/productName/extraResources/publish 반영, Assets/tray 아이콘
- package.json: electron-updater 의존 추가

## 설계 대비 조정
- D1: Window XML의 CloseOnOutsideClick 속성은 미구현. 바깥 클릭·ESC 닫기를 PaletteWindow가 직접 처리 (동작 동등).
- D2: Main 기존 4파일은 유지하고 AppHost 등으로 감싼다. Main.ts 진입점 이름 유지 (webpack entry 변경 없음).
- D3: 초성 fuzzy·코드 사이닝·PluginPack(adm-zip)은 사용자 확인 항목으로 보류 (22.4).

## 검증
1. lint/typecheck/build 녹색 (기존 3건 typecheck 오류는 손대지 않음)
2. Unit: Fuzzy/RecentStore/ShowPopup/Args/IpcHost/로그회전
3. E2E: 기존 5 + 팔레트 1 (SCOUTER_P4_MODE 미지정 시 real 스킵)
4. NSIS 산출물 + 사용자 설치·재부팅 확인은 사용자 차례

## 완료 기록 (2026-09-12)
- lint/typecheck(build 포함) 녹색. `npm run typecheck`는 Tests를 포함하지 않아 공식 스크립트 기준 녹색.
- unit 171개 중 170 통과, 1 실패 = 기존 Integration/Mcp (Node 24 libuv 크래시, 환경 문제).
- e2e 8개 중 7 통과 + real P4 1 스킵. 팔레트 2개 포함.
- `release/Scouter Setup 0.4.0.exe` (94MB) 생성. 서명 없음(사용자 확인 항목).
- 설계 대비 조정 추가:
- D4: `UIManager.Find`는 닫힌 창도 돌려주므로 팔레트 토글은 `IsClosed`로 가드.
- D5: `package.json`에 `main: dist/main/Main.cjs` 추가 (pack 필수). `description/author` 경고 해소용 추가.
- D6: Toast 액션 버튼 미지원으로 업데이트 Toast는 안내 문구 + 정보 창 버튼으로 대체.
- D7: 첫 실행 P4Util 복사 안내는 설치 시 자동 복사(`SeedBundledPlugins`)로 대체, 인앱 확인 UI는 생략.
- D8: `publish` URL은 자리표시자로 빌드. 실제 사내 URL 확정 시 `SCOUTER_UPDATE_URL` 지정 후 재빌드 필요.
- 사용자 확인 대기: 설치 → 재부팅 → 자동 실행 → Claude Code 재연결, 코드 사이닝 여부, 초성 fuzzy, PluginPack.
