# AGENTS.md — Scouter 외부 플러그인 체크리스트 (AI용)

> 대상: `Plugins/{Id}/` 외부 플러그인. 내장(`Source/Scouter.App/Renderer/BuiltIn/`)은 범위 밖.
> 상세 가이드는 `Docs/Plugin/Guide.md` (절차 전체), 화면 선언은 `Docs/Program/LayoutXml.md`,
> TS 작성은 `Docs/Program/TypeScript.md`. 막히면 Guide부터 읽는다.
> 참고 구현: `Plugins/P4Util/` (Tool·화면·레시피 전부), `Plugins/Notes/` (최소형),
> `Plugins/ToastLab/` (토스트·확인창), `Plugins/ControlLab/` (전 컨트롤 예시).

## 1. 뼈대 (`Docs/Plugin/Guide.md` §6)

```
Plugins/{Id}/
	Plugin.json            # 필수. 폴더명 == Id
	package.json           # name/version/type=module/private
	tsconfig.json          # base 확장, composite=false, noEmit, include 명시
	Index.ts               # default export PluginBase. 등록만
	Types.ts               # 공용 타입
	{Domain}Store.ts       # 상태 클래스 (가짜 주입 가능하게)
	Tools/{X}Tool.ts       # Tool 1개 = 1파일
	Views/MainControl.ts   # UserControl 1개. OnInit + static Configure
	Layout/Main.xml        # UserControl 루트
	Recipes/{X}.md         # 최소 1개
	Settings.schema.json   # 선택 (있으면 자동 등록)
```

## 2. 규칙 요약 (어기면 빨강)

- `Plugin.json`은 `Source/Scouter.App/Config/Plugin.schema.json`이 정답. 필수 `Id`(대문자 시작 영숫자) `Name` `Version`(x.y.z) `Main` `Layout`.
- `Permissions`는 필요만. `Tools`/`Commands` 배열은 실제 등록과 1:1.
- 설정 읽기는 스냅샷 금지, getter로 넘긴다. 키는 `Plugins.{Id}.{Key}`.
- `ITool` = `Name/Description/InputSchema` + `Run` (실패는 `throw`, 동기 throw는 `Promise.reject`로).
  읽기 전용 `Annotations = { ReadOnly: true }`, 저위험 쓰기 `DefaultApproval = "auto"`, 위험은 ask.
- 화면: `MainControl extends UserControl`, `OnInit`에서 `FindName/RequireName`.
  `UserControl.Data`는 `Int/Bool/String`만. 목록은 코드 `SetItems`로 채운다.
- `ctx` 필요 동작은 `static Configure` 주입. View에서 `require("electron")`·`node:*` 금지.
- 루트 `package.json`의 `typecheck`·`lint:layout`에 `Plugins/{Id}`, `Plugins/{Id}/Layout` 추가.
- 코딩 컨벤션: 탭, Allman, 파일 헤더, `////` 구분선, `_param`·`member_`·`s_`·`k`, 루프 `idx`, `any` 금지.

## 3. 테스트·포트

- 단위: `Source/Scouter.Tests/Unit/Plugin/{Id}.test.ts`, `describe("{Id}")` 1개.
- E2E: `Source/Scouter.Tests/E2E/{Id}.test.ts`. 사용 중: 9521 Shell, 9522 Mcp, 9523/9524 P4Util,
  9525 팔레트, 9526 Notes, 9527 Theme, 9528 ToastLab, 9529 ControlLab, 9530 SidebarNotice.
  **신규는 9531번부터.** 스폰: `dist/main/Main.cjs --test --hidden --no-auth --port {N} --plugin-dir Plugins`.
- 화면 확인: `GET /test/find?name=`, `POST /test/click`, `POST /test/eval`.
  합성 클릭은 hit-testing을 우회하므로 클릭 계열 수정 뒤에는 `Scripts/Testing/` 실마우스로 확인.

## 4. 동작 메모 (2026-09 기준)

- 파일 저장 → 300ms 디바운스. `.xml`만 자동 리로드, `.ts`/`.json`/`.css`는 사이드바 빨간 점 + 수동 리로드(우클릭 메뉴·F5·`Shell.ReloadPlugin`). 실패하면 느낌표. `.md` 등은 무시.
- `TabControl`은 직접 붙인 `TabItem`을 자동 채택한다. `TextBlock`은 `FontSize` 개별 지정 가능.
  `VirtualList`는 `ItemHeight` 생략 시 폰트 연동 자동 높이.

## 5. 검증 체인

```
npm run lint → npm run typecheck → npm run build → npm run test:unit → npm run test:e2e
npm run lint:layout / npm run lint:theme
```

## 6. 흔한 실패

| 증상 | 원인 |
|---|---|
| 사이드바 오류 뷰·느낌표 | `Layout` 오타·XML 파싱 실패·TS 오류. `/test/logs` 확인 후 다시 로드 |
| 권한 다이얼로그 무한 대기 | `Permissions` 과다 선언 |
| E2E에서 Tool 없음 | `OnActivate` 10초 타임아웃 또는 선언·등록 불일치 |
| 설정이 안 먹음 | 스냅샷 저장. getter로 바꿀 것 |
| `tsc -b` 누락 | §2 경로 미등록 |
