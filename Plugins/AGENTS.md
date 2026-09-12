# AGENTS.md — Scouter 외부 플러그인 추가 가이드 (AI용)

> 대상: `Plugins/{Id}/` 외부 플러그인. 내장(`Source/Scouter.App/Renderer/BuiltIn/`)은 이 문서 범위 밖.
> 참고 구현: `Plugins/P4Util/` (Tool 7종·화면·레시피 전부), `Plugins/Notes/` (최소형 4종).

## 1. 최소 뼈대

```
Plugins/{Id}/
	Plugin.json            # 필수. 폴더명 == Id (다르면 경고만)
	package.json           # name/version/type=module/private
	tsconfig.json          # base 확장, composite=false, noEmit, include 명시
	Index.ts               # default export PluginBase
	Types.ts               # 공용 타입
	NoteStore.ts           # 상태·외부연동 클래스 (도메인별 이름)
	Tools/{X}Tool.ts       # Tool 1개 = 1파일
	Views/MainControl.ts   # UserControl 1개
	Layout/Main.xml        # UserControl 루트
	Recipes/{X}.md         # 최소 1개 (P11 조건)
	Settings.schema.json   # 있으면 자동 등록
```

## 2. Plugin.json

`Source/Scouter.App/Config/Plugin.schema.json`이 정답. 필수: `Id`(대문자 시작 영숫자) `Name` `Version`(x.y.z) `Main` `Layout`.
`Permissions`는 `Process/Fs.Read/Fs.Write/Clipboard/Settings/Secrets/Network/Tools.Invoke` 중 필요만.
없으면 권한 다이얼로그가 안 뜬다. `Tools`/`Commands` 배열은 실제 등록과 대조된다(어긋나면 경고·에러 로그).

## 3. Index.ts 패턴

```ts
export default class XPlugin extends PluginBase
{
	protected override OnActivate(_ctx: IPluginContext): void
	{
		_ctx.Tools.Register(new FooTool(deps));          // MCP Tool 등록. 이름은 {Id}__{Tool명} 자동
		_ctx.Ui.RegisterWindow("Main", MainControl);     // 사이드바 화면. "{Id}/Main" 등록
		MainControl.Configure(shared);                   // View가 ctx를 못 받으니 static 주입 (P4Util/Notes/McpInspector 패턴)
		_ctx.Commands.Register("Bar", { Title: "...", Hotkey: "Ctrl+Shift+X", Run: () => {...} });
		// _ctx.Resources.Register / _ctx.Prompts.Register — 레시피·프롬프트
	}
}
```

- 설정 읽기는 스냅샷 금지. getter 객체로 넘긴다 (P4Util `ReadSettings` 참조).
  설정 키는 `Plugins.{Id}.{Key}`. E2E에서 `/test/settings`로 바꿔도 실행 시점에 읽히게.
- `ctx.Fs`는 `StorageDir`·`PluginDir` 안이 자유. 밖은 권한 필요.
- 파일명 slug 등 외부 입력 → 경로 탈출 검증 (`..`·`/` 거부).

## 4. Tool 작성

`ITool` = `Name/Description/InputSchema` + `Run(_args, _call): Promise<unknown>`.
실패는 `throw` (문자열 반환 금지). 인자 검증은 `ReadXArgs` 함수로 분리.

| 종류 | 선언 |
|---|---|
| 읽기 전용 | `Annotations = { ReadOnly: true }` → 승인 auto |
| 쓰기·저위험(자기 notes 등) | `DefaultApproval = "auto"` (Notes 선례, 결정 사유 남길 것) |
| 위험 | `Annotations = { Destructive: true }` 또는 미선언 → `Mcp.DefaultApproval`(기본 ask) |

## 5. 화면 (Views + Layout)

- `MainControl extends UserControl`, `OnInit`에서 `FindName/RequireName` 바인딩.
- `UserControl.Data` 타입은 `Int/Bool/String`만. 바인딩 식 `{{@x} + `s`}`, 문자열 리터럴은 백틱.
- 목록+본문 구조는 P4Util `Main.xml`·Notes `Main.xml` 복사 후 수정이 가장 빠름.
- 우클릭 메뉴: `new ContextMenu()` + `MenuItem` → `control.ContextMenu = menu` (P4Util `BindMenu` 참조).
- `ctx`가 필요한 동작(클립보드 등)은 `static Configure`로 주입. View에서 직접 `require("electron")` 금지.

## 6. package.json 등록 (잊으면 CI 빨강)

```json
"typecheck": "... Plugins/P4Util Plugins/Notes Plugins/{Id}",
"lint:layout": "... Plugins/P4Util/Layout Plugins/Notes/Layout Plugins/{Id}/Layout",
```

## 7. 테스트

- 단위: `Source/Scouter.Tests/Unit/Plugin/{Id}.test.ts`. 외부연동은 가짜 객체 주입
  (Notes `MemoryFs` 참조). 파일 1개에 `describe("{Id}")`.
- E2E: `Source/Scouter.Tests/E2E/{Id}.test.ts`. 포트 규칙: 9521 Shell, 9522 Mcp, 9523/9524 P4Util, 9525 팔레트, 9526 Notes 사용 중 — **9527번부터** 새 번호.
  스폰 인자: `dist/main/Main.cjs --test --hidden --no-auth --port {N} --plugin-dir Plugins`.
  승인 필요 Tool이면 `before`에서 `POST /test/approval {Policy:"allow"}`.
  `--plugin-dir Plugins`라 새 플러그인은 자동 발견. StorageDir은 pid별 temp라 격리됨.
- 서버·바이너리 의존이면 P4Util E2E처럼 `SCOUTER_X_MODE` + `t.skip()` 분기.

## 8. 코딩 컨벤션 (위반하면 lint 빨강)

탭 들여쓰기, Allman 브레이스, 파일 헤더 주석, `////` 메서드 구분선, 멤버 그룹 순서
(정적→멤버→생성·소멸→속성→이벤트→공개→확장점→내부), `public/protected/private` 명시,
`_param`·`member_`·`s_`·`k` 접두, 루프 `idx`(`i` 금지), `any` 금지, 파일 1개 = 클래스 1개.
한글 주석은 Write 도구로만 작성.

## 9. 검증 체인 (순서대로, 전부 녹색)

```
npm run lint → npm run typecheck → npm run build → npm run test:unit → npm run test:e2e
```

## 10. 흔한 실패

| 증상 | 원인 |
|---|---|
| 사이드바에 오류 뷰 | `Layout` 경로 오타·XML 파싱 실패 (`LayoutXml=null` 아님. 로그 확인) |
| 권한 다이얼로그 무한 대기 | `Permissions` 과다 선언. E2E는 `/test/permission` 또는 선언 축소 |
| E2E에서 Tool 없음 | `OnActivate` 10초 타임아웃 초과, 또는 `Tools` 선언·등록 불일치 |
| 설정이 안 먹음 | 스냅샷 저장. getter로 바꿀 것 (§3) |
| `tsc -b`에 새 플러그인 누락 | §6 미등록 |
